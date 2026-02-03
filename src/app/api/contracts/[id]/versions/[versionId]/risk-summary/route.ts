import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import { buildExecutiveSummary } from "@/core/services/risk/executiveSummary";

/** GET: return risk aggregation + executive summary for version + policy. VIEWER can read. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const policyId = new URL(req.url).searchParams.get("policyId");
    if (!policyId?.trim()) {
      return NextResponse.json({ error: "Missing policyId" }, { status: 400 });
    }
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = (contract as { versions: { id: string }[] }).versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const aggregation = await aggregateRisk({ contractId, contractVersionId: versionId, policyId });
    if (!aggregation) {
      return NextResponse.json(
        { error: "No compliance record for this version and policy. Run analysis first." },
        { status: 404 }
      );
    }
    const summary = buildExecutiveSummary(aggregation);
    return NextResponse.json({ aggregation, summary });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
