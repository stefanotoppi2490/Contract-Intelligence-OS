import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import { compareVersions } from "@/core/services/compare/versionCompare";
import { buildCompareReportHtml } from "@/core/services/reports/versionCompareReport";
import { recordEvent } from "@/core/services/ledger/ledgerService";

const reportBodySchema = { fromVersionId: String, toVersionId: String, policyId: String };

/** POST: export version compare report as HTML. Body: { fromVersionId, toVersionId, policyId }. RBAC: LEGAL/RISK/ADMIN. */
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
    const html = buildCompareReportHtml(outcome.result, {
      contractTitle: contract.title,
      policyName: policy.name,
      workspaceName: workspace?.name ?? undefined,
    });
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
        fromVersionNumber: outcome.result.from.versionNumber,
        toVersionNumber: outcome.result.to.versionNumber,
        policyId,
      },
    });
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="compare-v${outcome.result.from.versionNumber}-v${outcome.result.to.versionNumber}.html"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
