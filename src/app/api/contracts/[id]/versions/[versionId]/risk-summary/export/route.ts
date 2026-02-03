import type { LedgerEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import { buildExecutiveSummary } from "@/core/services/risk/executiveSummary";
import { buildExecutiveSummaryHtml } from "@/core/services/risk/executiveSummaryReport";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** POST: export executive summary as HTML. Body: { policyId }. Records REPORT_EXPORTED. VIEWER can read/export. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const body = await req.json().catch(() => ({}));
    const policyId = typeof body.policyId === "string" ? body.policyId.trim() : "";
    if (!policyId) {
      return NextResponse.json({ error: "Missing policyId" }, { status: 400 });
    }
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = (contract as { versions: { id: string; versionNumber: number }[] }).versions.find(
      (v) => v.id === versionId
    );
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const aggregation = await aggregateRisk({ contractId, contractVersionId: versionId, policyId });
    if (!aggregation) {
      return NextResponse.json(
        { error: "No compliance record for this version and policy. Run analysis first." },
        { status: 404 }
      );
    }
    const summary = buildExecutiveSummary(aggregation);
    const workspace = await workspaceRepo.findWorkspaceById(workspaceId);

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
        policyId,
        effectiveScore: aggregation.effectiveScore,
      },
    });

    const html = buildExecutiveSummaryHtml(aggregation, summary, {
      contractTitle: contract.title,
      policyName: policy.name,
      workspaceName: workspace?.name ?? undefined,
    });
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="Executive_Summary_v${version.versionNumber}.html"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
