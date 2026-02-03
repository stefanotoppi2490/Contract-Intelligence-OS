/**
 * STEP 9A: Deterministic risk aggregation from ClauseFinding + ContractCompliance.
 * Read-only; does not change scoring or findings.
 */

import type { RiskAggregation, RiskCluster, RiskClusterTopDriver, RiskTypeKey, ClusterLevel, SeverityKey, OverallStatusKey } from "./riskAggregation";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

const RISK_TYPES: RiskTypeKey[] = ["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"];
const SEVERITY_ORDER: (SeverityKey | null)[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", null];

function severityRank(s: string | null): number {
  const i = SEVERITY_ORDER.indexOf(s as SeverityKey | null);
  return i >= 0 ? i : SEVERITY_ORDER.length;
}

function maxSeverity(a: string | null, b: string | null): SeverityKey | null {
  if (!a) return b as SeverityKey | null;
  if (!b) return a as SeverityKey | null;
  return severityRank(a) <= severityRank(b) ? (a as SeverityKey) : (b as SeverityKey);
}

export type AggregateRiskInput = {
  contractId: string;
  contractVersionId: string;
  policyId: string;
};

export async function aggregateRisk(input: AggregateRiskInput): Promise<RiskAggregation | null> {
  const { contractId, contractVersionId, policyId } = input;

  const [compliance, findings, approvedExceptions] = await Promise.all([
    contractComplianceRepo.findContractComplianceByVersionAndPolicy(contractVersionId, policyId),
    clauseFindingRepo.findManyClauseFindingsByContractVersion(contractVersionId, { include: { rule: true } }),
    exceptionRepo.findApprovedExceptionsByContractVersion(contractVersionId),
  ]);

  if (!compliance) return null;

  const policyFindings = findings.filter(
    (f) => (f.rule as { policyId?: string })?.policyId === policyId
  );
  const overriddenFindingIds = new Set(
    approvedExceptions.map((e) => e.clauseFindingId).filter((id): id is string => id != null)
  );

  let effectiveScore = compliance.score;
  const ruleWeightByFindingId = new Map<string, number>();
  for (const f of policyFindings) {
    const weight = (f.rule as { weight?: number })?.weight ?? 1;
    ruleWeightByFindingId.set(f.id, weight);
    if ((f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") && overriddenFindingIds.has(f.id)) {
      effectiveScore = Math.min(100, effectiveScore + weight);
    }
  }

  const clusters: RiskCluster[] = RISK_TYPES.map((riskType) => {
    const forType = policyFindings.filter((f) => f.riskType === riskType);
    const violationFindings = forType.filter((f) => f.complianceStatus === "VIOLATION");
    const unclearFindings = forType.filter((f) => f.complianceStatus === "UNCLEAR");
    const overriddenFindings = forType.filter(
      (f) => (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") && overriddenFindingIds.has(f.id)
    );

    const violationCount = violationFindings.length;
    const unclearCount = unclearFindings.length;
    const overriddenCount = overriddenFindings.length;

    const nonOverriddenViolations = violationFindings.filter((f) => !overriddenFindingIds.has(f.id));
    const totalWeight = nonOverriddenViolations.reduce(
      (sum, f) => sum + (ruleWeightByFindingId.get(f.id) ?? 1),
      0
    );

    const driversSource = forType.filter(
      (f) => f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR"
    );
    const topDrivers: RiskClusterTopDriver[] = driversSource
      .sort((a, b) => (ruleWeightByFindingId.get(b.id) ?? 1) - (ruleWeightByFindingId.get(a.id) ?? 1))
      .slice(0, 3)
      .map((f) => ({
        clauseType: f.clauseType,
        severity: f.severity,
        weight: ruleWeightByFindingId.get(f.id) ?? 1,
        reason: f.recommendation ?? (f.complianceStatus === "VIOLATION" ? "Policy violation." : "Needs review."),
      }));

    const allSeverities = forType.map((f) => f.severity).filter((s): s is string => s != null);
    const maxSev: SeverityKey | null =
      allSeverities.length
        ? (allSeverities.reduce((m, s) => (severityRank(s) < severityRank(m) ? s : m), allSeverities[0]) as SeverityKey)
        : null;

    const hasCriticalViolation = violationFindings.some((f) => f.severity === "CRITICAL");
    let level: ClusterLevel;
    if (hasCriticalViolation) level = "HIGH";
    else if (violationCount > 0) level = "MEDIUM";
    else if (unclearCount > 0) level = "NEEDS_REVIEW";
    else level = "OK";

    return {
      riskType,
      level,
      violationCount,
      unclearCount,
      overriddenCount,
      maxSeverity: maxSev,
      totalWeight,
      topDrivers,
    };
  });

  const allTopDrivers: RiskClusterTopDriver[] = policyFindings
    .filter((f) => f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR")
    .map((f) => ({
      clauseType: f.clauseType,
      severity: f.severity,
      weight: ruleWeightByFindingId.get(f.id) ?? 1,
      reason: f.recommendation ?? (f.complianceStatus === "VIOLATION" ? "Policy violation." : "Needs review."),
    }))
    .sort((a, b) => b.weight - a.weight);

  let overallStatus: OverallStatusKey;
  if (effectiveScore < 60) {
    overallStatus = "NON_COMPLIANT";
  } else if (clusters.some((c) => c.level === "HIGH" || c.level === "MEDIUM" || c.level === "NEEDS_REVIEW")) {
    overallStatus = "NEEDS_REVIEW";
  } else {
    overallStatus = "COMPLIANT";
  }

  return {
    contractId,
    contractVersionId,
    policyId,
    overallStatus,
    rawScore: compliance.score,
    effectiveScore,
    clusters,
    topDrivers: allTopDrivers,
    generatedAt: new Date().toISOString(),
  };
}
