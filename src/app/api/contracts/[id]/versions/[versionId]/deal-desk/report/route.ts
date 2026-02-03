import type { LedgerEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";
import { buildDealDeskHtml, buildDealDeskPdf, type DealDeskReportPayload } from "@/core/services/reports/dealDeskReport";
import { recordEvent } from "@/core/services/ledger/ledgerService";

const bodySchema = z.object({
  policyId: z.string().min(1),
  format: z.enum(["pdf", "html"]),
});

const RISK_TYPES = ["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"] as const;

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

/** POST: generate Deal Desk report (PDF or HTML). LEGAL/RISK/ADMIN only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const { policyId, format } = parsed.data;
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const preview = await computeDealDecisionPreview(contractId, versionId, policyId);
    if (!preview) {
      return NextResponse.json(
        { error: "MISSING_ANALYSIS", message: "Run analysis first." },
        { status: 409 }
      );
    }
    const decision = await dealDecisionRepo.findDealDecisionByVersionAndPolicy(versionId, policyId);
    const [workspace, exceptions] = await Promise.all([
      workspaceRepo.findWorkspaceById(workspaceId),
      exceptionRepo.findManyExceptionRequestsByContractVersion(versionId, {
        where: { policyId },
        select: { id: true, title: true, status: true },
      }),
    ]);
    const approved = exceptions.filter((e) => e.status === "APPROVED").map((e) => ({ id: e.id, title: e.title }));
    const open = exceptions.filter((e) => e.status === "REQUESTED").map((e) => ({ id: e.id, title: e.title }));
    const riskByType = RISK_TYPES.map((rt) => ({
      riskType: rt,
      violations: preview.counts.violations
        ? (preview.riskTypeBreakdown[rt]?.violations ?? 0)
        : 0,
      unclear: preview.riskTypeBreakdown[rt]?.unclear ?? 0,
    }));
    const payload: DealDeskReportPayload = {
      contractTitle: (contract as { title: string }).title,
      counterpartyName: (contract as { counterparty?: { name: string } }).counterparty?.name ?? "",
      versionNumber: (version as { versionNumber: number }).versionNumber,
      policyName: decision?.policy?.name ?? "Policy",
      outcome: (decision ?? preview).outcome,
      effectiveScore: preview.effectiveScore,
      rawScore: preview.rawScore,
      rationale: (decision ?? { rationale: preview.rationaleMarkdown }).rationale,
      counts: preview.counts,
      riskByType,
      topDrivers: preview.topDrivers,
      approvedExceptions: approved,
      openExceptions: open,
      narrative: decision?.executiveSummary ?? null,
      generatedAt: new Date().toISOString(),
      workspaceName: workspace?.name ?? "",
      status: decision?.status ?? "DRAFT",
      finalizedAt: decision?.finalizedAt?.toISOString() ?? null,
    };
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "DEAL_DESK_REPORT_EXPORTED" as LedgerEventType,
      entityType: "DealDecision",
      entityId: decision?.id ?? versionId,
      contractId,
      contractVersionId: versionId,
      policyId,
      metadata: { outcome: payload.outcome, format, effectiveScore: payload.effectiveScore },
    });
    const baseName = `DealDesk_${safeFilename(payload.contractTitle)}_v${payload.versionNumber}_${safeFilename(payload.policyName)}`;
    if (format === "html") {
      const html = buildDealDeskHtml(payload);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.html"`,
        },
      });
    }
    const pdfBytes = await buildDealDeskPdf(payload);
    const buffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(buffer).set(pdfBytes);
    return new NextResponse(new Blob([buffer], { type: "application/pdf" }), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
