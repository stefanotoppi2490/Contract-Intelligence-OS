/**
 * STEP 10: Dashboard row aggregation — effectiveScore, status, counts from compliance + findings + exceptions.
 * Same logic as aggregateRisk for effective score; no DB writes.
 */

import type { ComplianceStatusType } from "@prisma/client";
import type { RiskType } from "@prisma/client";

export type DashboardRowRiskBreakdown = Record<string, { violations: number; unclear: number }>;

type FindingLike = {
  id: string;
  complianceStatus: string;
  riskType: string | null;
  rule?: { policyId?: string; weight?: number } | null;
};
type ComplianceLike = { score: number; status: ComplianceStatusType };
type ApprovedExceptionLike = { clauseFindingId: string | null };

export type DashboardRowAggregation = {
  effectiveScore: number;
  status: ComplianceStatusType;
  violationCount: number;
  unclearCount: number;
  overriddenCount: number;
  riskTypeBreakdown: DashboardRowRiskBreakdown;
};

const RISK_TYPES: RiskType[] = ["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"];

export function computeDashboardRowAggregation(
  compliance: ComplianceLike,
  policyFindings: FindingLike[],
  approvedExceptions: ApprovedExceptionLike[]
): DashboardRowAggregation {
  const overriddenFindingIds = new Set(
    approvedExceptions.map((e) => e.clauseFindingId).filter((id): id is string => id != null)
  );

  let effectiveScore = compliance.score;
  const ruleWeightByFindingId = new Map<string, number>();
  for (const f of policyFindings) {
    const weight = (f.rule?.weight ?? 1) as number;
    ruleWeightByFindingId.set(f.id, weight);
    if (
      (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") &&
      overriddenFindingIds.has(f.id)
    ) {
      effectiveScore = Math.min(100, effectiveScore + weight);
    }
  }

  const violationFindings = policyFindings.filter((f) => f.complianceStatus === "VIOLATION");
  const unclearFindings = policyFindings.filter((f) => f.complianceStatus === "UNCLEAR");
  const overriddenCount = policyFindings.filter(
    (f) =>
      (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") &&
      overriddenFindingIds.has(f.id)
  ).length;

  const riskTypeBreakdown: DashboardRowRiskBreakdown = {};
  for (const rt of RISK_TYPES) {
    const forType = policyFindings.filter((f) => f.riskType === rt);
    riskTypeBreakdown[rt] = {
      violations: forType.filter((f) => f.complianceStatus === "VIOLATION").length,
      unclear: forType.filter((f) => f.complianceStatus === "UNCLEAR").length,
    };
  }

  const violationCount = violationFindings.length;
  const unclearCount = unclearFindings.length;

  let status: ComplianceStatusType = compliance.status;
  if (effectiveScore < 60) {
    status = "NON_COMPLIANT";
  } else if (violationCount > 0 || unclearCount > 0) {
    status = "NEEDS_REVIEW";
  } else {
    status = "COMPLIANT";
  }

  return {
    effectiveScore,
    status,
    violationCount,
    unclearCount,
    overriddenCount,
    riskTypeBreakdown,
  };
}
