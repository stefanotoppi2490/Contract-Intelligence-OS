import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";

/** GET: return compliance records (score per policy) + findings for this version. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const [compliances, findings] = await Promise.all([
      contractComplianceRepo.findManyContractCompliancesByContractVersion(versionId),
      clauseFindingRepo.findManyClauseFindingsByContractVersion(versionId),
    ]);
    return NextResponse.json({
      contractVersionId: versionId,
      compliances: compliances.map((c) => ({
        policyId: c.policyId,
        policyName: c.policy.name,
        score: c.score,
        status: c.status,
      })),
      findings: findings.map((f) => ({
        id: f.id,
        clauseType: f.clauseType,
        ruleId: f.ruleId,
        complianceStatus: f.complianceStatus,
        severity: f.severity,
        riskType: f.riskType,
        recommendation: f.recommendation,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
