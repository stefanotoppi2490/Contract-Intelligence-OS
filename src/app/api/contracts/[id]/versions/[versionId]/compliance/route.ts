import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

/** GET: return compliance (rawScore, effectiveScore per policy) + findings with isOverridden, exceptionId, exceptionStatus. */
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
    const [compliances, findings, approvedExceptions] = await Promise.all([
      contractComplianceRepo.findManyContractCompliancesByContractVersion(versionId),
      clauseFindingRepo.findManyClauseFindingsByContractVersion(versionId),
      exceptionRepo.findApprovedExceptionsByContractVersion(versionId),
    ]);

    const findingIdToException = new Map<string, { id: string }>();
    for (const ex of approvedExceptions) {
      if (ex.clauseFindingId) {
        findingIdToException.set(ex.clauseFindingId, { id: ex.id });
      }
    }

    const findingsPayload = findings.map((f) => {
      const ex = findingIdToException.get(f.id);
      const isOverridden = ex != null && (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR");
      return {
        id: f.id,
        clauseType: f.clauseType,
        ruleId: f.ruleId,
        complianceStatus: f.complianceStatus,
        severity: f.severity,
        riskType: f.riskType,
        recommendation: f.recommendation,
        foundText: f.foundText ?? null,
        foundValue: f.foundValue ?? null,
        confidence: f.confidence ?? null,
        parseNotes: f.parseNotes ?? null,
        expectedValue: f.rule?.expectedValue ?? null,
        isOverridden: isOverridden ?? false,
        exceptionId: ex?.id ?? null,
        exceptionStatus: ex ? "APPROVED" : null,
      };
    });

    const ruleWeightByFindingId = new Map<string, number>();
    for (const f of findings) {
      const weight = (f.rule as { weight?: number })?.weight ?? 1;
      ruleWeightByFindingId.set(f.id, weight);
    }

    const compliancesPayload = compliances.map((c) => {
      let effectiveScore = c.score;
      for (const f of findings) {
        const policyId = (f.rule as { policyId?: string })?.policyId;
        if (policyId !== c.policyId) continue;
        if (f.complianceStatus !== "VIOLATION" && f.complianceStatus !== "UNCLEAR") continue;
        if (!findingIdToException.has(f.id)) continue;
        const weight = ruleWeightByFindingId.get(f.id) ?? 1;
        effectiveScore = Math.min(100, effectiveScore + weight);
      }
      return {
        policyId: c.policyId,
        policyName: c.policy.name,
        rawScore: c.score,
        score: c.score,
        effectiveScore,
        status: c.status,
      };
    });

    return NextResponse.json({
      contractVersionId: versionId,
      compliances: compliancesPayload,
      findings: findingsPayload,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
