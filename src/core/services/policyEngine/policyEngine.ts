/**
 * Deterministic policy engine (NO AI).
 * Evaluates contract version against policy rules; REQUIRED with no clause → VIOLATION.
 * Score: 100 - weight per VIOLATION; CRITICAL caps score at 40.
 */

import type { FindingComplianceStatus, ComplianceStatusType, PolicyRuleType } from "@prisma/client";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";

const SCORE_FULL = 100;
const SCORE_CAP_IF_CRITICAL = 40;

export type AnalyzeInput = { contractVersionId: string; policyId: string };

export type AnalyzeResult = {
  contractVersionId: string;
  policyId: string;
  score: number;
  status: ComplianceStatusType;
  findingsCount: number;
  violationsCount: number;
};

/**
 * Run deterministic policy evaluation for a contract version and policy.
 * For each rule: REQUIRED with no clause → VIOLATION; else NOT_APPLICABLE (for now).
 * Creates ClauseFinding records and one ContractCompliance.
 * Idempotent: re-running overwrites findings and compliance for this version+policy.
 */
export async function analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
  const { contractVersionId, policyId } = input;
  const policy = await policyRepo.findPolicyById(policyId);
  if (!policy) {
    throw new Error("Policy not found");
  }
  const rules = await policyRuleRepo.findManyPolicyRulesByPolicyId(policyId);
  if (rules.length === 0) {
    const score = SCORE_FULL;
    const status = scoreToStatus(score);
    await contractComplianceRepo.upsertContractCompliance(contractVersionId, policyId, {
      score,
      status,
    });
    return {
      contractVersionId,
      policyId,
      score,
      status,
      findingsCount: 0,
      violationsCount: 0,
    };
  }

  let totalDeduction = 0;
  let hasCriticalViolation = false;

  for (const rule of rules) {
    const { complianceStatus, deduction, isCritical } = evaluateRule(rule);
    totalDeduction += deduction;
    if (isCritical) hasCriticalViolation = true;

    await clauseFindingRepo.upsertClauseFinding(contractVersionId, rule.id, {
      clauseType: rule.clauseType,
      complianceStatus,
      severity: rule.severity ?? undefined,
      riskType: rule.riskType ?? undefined,
      recommendation: complianceStatus === "VIOLATION" ? rule.recommendation : null,
    });
  }

  let score = Math.max(0, SCORE_FULL - totalDeduction);
  if (hasCriticalViolation && score > SCORE_CAP_IF_CRITICAL) {
    score = SCORE_CAP_IF_CRITICAL;
  }
  const status = scoreToStatus(score);

  await contractComplianceRepo.upsertContractCompliance(contractVersionId, policyId, {
    score,
    status,
  });

  const violationsCount = rules.filter((r) => {
    const { complianceStatus } = evaluateRule(r);
    return complianceStatus === "VIOLATION";
  }).length;

  return {
    contractVersionId,
    policyId,
    score,
    status,
    findingsCount: rules.length,
    violationsCount,
  };
}

function evaluateRule(rule: { ruleType: PolicyRuleType; weight: number; severity: string | null }): {
  complianceStatus: FindingComplianceStatus;
  deduction: number;
  isCritical: boolean;
} {
  if (rule.ruleType === "REQUIRED") {
    // No clause extraction yet → treat as "no clause provided" → VIOLATION
    const deduction = rule.weight;
    const isCritical = rule.severity === "CRITICAL";
    return {
      complianceStatus: "VIOLATION",
      deduction,
      isCritical,
    };
  }
  return {
    complianceStatus: "NOT_APPLICABLE",
    deduction: 0,
    isCritical: false,
  };
}

function scoreToStatus(score: number): ComplianceStatusType {
  if (score >= 80) return "COMPLIANT";
  if (score >= 50) return "NEEDS_REVIEW";
  return "NON_COMPLIANT";
}
