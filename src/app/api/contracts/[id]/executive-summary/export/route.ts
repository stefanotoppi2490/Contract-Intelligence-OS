import type { LedgerEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import { buildExecutiveSummary } from "@/core/services/risk/executiveSummary";
import { findApprovedExceptionsWithTitlesByContractVersion } from "@/core/db/repositories/exceptionRepo";
import {
  buildExecutiveMarkdown,
  buildExecutiveHtml,
  buildExecutivePdf,
  type ExecutiveExportModel,
} from "@/core/services/reports/executiveSummaryReport";
import { buildExecutiveNarrativeInput, generateExecutiveNarrative } from "@/core/services/reports/executiveNarrativeAI";
import { recordEvent } from "@/core/services/ledger/ledgerService";

type ContractDetail = Awaited<ReturnType<typeof contractRepo.getContractDetail>>;
type VersionWithCompliance = {
  id: string;
  versionNumber: number;
  contractCompliance: Array<{ policyId: string; policy: { id: string; name: string } }>;
};

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

/** POST: export executive summary as PDF / HTML / MD. Body: { policyId, versionId, format, includeNarrative }. PDF: LEGAL/RISK/ADMIN only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId } = await params;
    const body = await req.json().catch(() => ({}));
    const policyId = typeof body.policyId === "string" ? body.policyId.trim() : "";
    const versionId = typeof body.versionId === "string" ? body.versionId.trim() : "";
    const format = body.format === "pdf" ? "pdf" : body.format === "md" ? "md" : "html";
    const includeNarrative = body.includeNarrative === true;

    if (!policyId || !versionId) {
      return NextResponse.json(
        { error: "Missing policyId or versionId" },
        { status: 400 }
      );
    }

    if (format === "pdf") {
      requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    }

    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const c = contract as unknown as ContractDetail & {
      title: string;
      counterparty?: { name: string };
      contractType?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
      versions: Array<VersionWithCompliance>;
    };
    const version = c.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const aggregation = await aggregateRisk({
      contractId,
      contractVersionId: versionId,
      policyId,
    });
    if (!aggregation) {
      return NextResponse.json(
        { error: "No compliance record for this version and policy. Run analysis first." },
        { status: 404 }
      );
    }

    const summary = buildExecutiveSummary(aggregation);
    const [workspace, exceptions] = await Promise.all([
      workspaceRepo.findWorkspaceById(workspaceId),
      findApprovedExceptionsWithTitlesByContractVersion(versionId),
    ]);

    let narrative: string | null = null;
    if (includeNarrative) {
      const input = buildExecutiveNarrativeInput(aggregation, c.title, policy.name);
      narrative = await generateExecutiveNarrative(input, aggregation);
    }

    const model: ExecutiveExportModel = {
      contractTitle: c.title,
      counterpartyName: c.counterparty?.name ?? "",
      contractType: c.contractType ?? null,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      versionNumber: version.versionNumber,
      policyName: policy.name,
      decision: summary.headline,
      overallStatus: aggregation.overallStatus,
      rawScore: aggregation.rawScore,
      effectiveScore: aggregation.effectiveScore,
      clusters: aggregation.clusters.map((x) => ({
        riskType: x.riskType,
        level: x.level,
        violations: x.violationCount,
        unclear: x.unclearCount,
      })),
      keyRisks: aggregation.topDrivers.slice(0, 5).map((d) => `${d.clauseType}: ${d.reason}`),
      exceptions: {
        count: exceptions.length,
        items: exceptions.map((e) => ({ id: e.id, title: e.title })),
      },
      narrative,
      generatedAt: aggregation.generatedAt,
      workspaceName: workspace?.name ?? "",
    };

    const baseName = `ExecutiveSummary_${safeFilename(c.title)}_v${version.versionNumber}_${safeFilename(policy.name)}`;

    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "REPORT_EXPORTED" as LedgerEventType,
      entityType: "ExecutiveSummary",
      entityId: `${versionId}-${policyId}`,
      contractId,
      contractVersionId: versionId,
      policyId,
      metadata: {
        reportType: "EXECUTIVE_SUMMARY",
        action: "EXECUTIVE_EXPORT",
        format,
        policyId,
        effectiveScore: aggregation.effectiveScore,
      },
    });

    if (format === "md") {
      const md = buildExecutiveMarkdown(model);
      return new NextResponse(md, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.md"`,
        },
      });
    }

    if (format === "html") {
      const html = buildExecutiveHtml(model);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.html"`,
        },
      });
    }

    const pdfBytes = await buildExecutivePdf(model);
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
