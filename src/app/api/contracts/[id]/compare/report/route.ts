import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import { compareVersions } from "@/core/services/compare/versionCompare";
import { buildCompareReportHtml } from "@/core/services/reports/versionCompareReport";
import { buildComparePdf } from "@/core/services/reports/versionComparePdf";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** POST: export version compare report. Body: { fromVersionId, toVersionId, policyId, format?: "pdf" | "html" }. Default format: html. RBAC: LEGAL/RISK/ADMIN. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId } = await params;
    const body = await req.json().catch(() => ({}));
    const fromVersionId = typeof body.fromVersionId === "string" ? body.fromVersionId : "";
    const toVersionId = typeof body.toVersionId === "string" ? body.toVersionId : "";
    const policyId = typeof body.policyId === "string" ? body.policyId : "";
    const format = body.format === "pdf" ? "pdf" : "html";
    if (!fromVersionId || !toVersionId || !policyId) {
      return NextResponse.json(
        { error: "Missing fromVersionId, toVersionId, or policyId" },
        { status: 400 }
      );
    }
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const fromVersion = contract.versions.find((v) => v.id === fromVersionId);
    const toVersion = contract.versions.find((v) => v.id === toVersionId);
    if (!fromVersion || !toVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    if (!outcome.ok) {
      return NextResponse.json(
        { error: "Missing analysis for version", code: outcome.code, missingVersionId: outcome.missingVersionId },
        { status: 409 }
      );
    }
    const workspace = await workspaceRepo.findWorkspaceById(workspaceId);
    const fromNum = outcome.result.from.versionNumber;
    const toNum = outcome.result.to.versionNumber;

    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "REPORT_EXPORTED",
      entityType: "VersionCompareReport",
      entityId: `${fromVersionId}-${toVersionId}`,
      contractId,
      contractVersionId: toVersionId,
      policyId,
      metadata: {
        fromVersionId,
        toVersionId,
        fromVersionNumber: fromNum,
        toVersionNumber: toNum,
        policyId,
        format,
      },
    });

    if (format === "pdf") {
      const pdfBytes = await buildComparePdf(outcome.result, {
        contractTitle: contract.title,
        policyName: policy.name,
        workspaceName: workspace?.name ?? undefined,
      });
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Contract_Compare_v${fromNum}_vs_v${toNum}.pdf"`,
        },
      });
    }

    const html = buildCompareReportHtml(outcome.result, {
      contractTitle: contract.title,
      policyName: policy.name,
      workspaceName: workspace?.name ?? undefined,
    });
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="compare-v${fromNum}-v${toNum}.html"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
