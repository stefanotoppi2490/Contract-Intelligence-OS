/**
 * Policy engine: STEP 5B AI-assisted extraction + deterministic evaluation.
 * Loads ContractVersionText (TEXT_READY), runs aiClauseExtractor, then evaluates each rule
 * deterministically. Score: 100 - weight per VIOLATION; CRITICAL caps at 40.
 */

import type {
  FindingComplianceStatus,
  ComplianceStatusType,
  PolicyRuleType,
  ClauseTaxonomy,
} from "@prisma/client";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as contractVersionTextRepo from "@/core/db/repositories/contractVersionTextRepo";
import {
  extractClauses,
  type ExtractionResult,
} from "@/core/services/policy/aiClauseExtractor";

const SCORE_FULL = 100;
const SCORE_CAP_IF_CRITICAL = 40;
const CONFIDENCE_THRESHOLD = 0.5;
const CONFIDENCE_THRESHOLD_FORBIDDEN = 0.6;
const ENGINE_VERSION = "5b-1";

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
 * Run AI extraction + deterministic evaluation for a contract version and policy.
 * Requires ContractVersionText with status TEXT_READY. Idempotent.
 */
export async function analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
  const { contractVersionId, policyId } = input;
  const policy = await policyRepo.findPolicyById(policyId);
  if (!policy) {
    throw new Error("Policy not found");
  }

  const versionText = await contractVersionTextRepo.findContractVersionTextByVersionId(
    contractVersionId
  );
  if (!versionText || versionText.status !== "TEXT_READY") {
    throw new Error("Contract text not ready for analysis. Extract text first.");
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

  const extractionResults = await extractClauses({
    contractText: versionText.text,
    rules: rules.map((r) => ({
      ruleId: r.id,
      clauseType: r.clauseType,
      ruleType: r.ruleType,
      expectedValue: r.expectedValue,
    })),
  });

  const byRuleId = new Map<string, ExtractionResult>();
  for (const e of extractionResults) {
    byRuleId.set(e.ruleId, e);
  }

  const evaluatedAt = new Date();
  let totalDeduction = 0;
  let hasCriticalViolation = false;

  for (const rule of rules) {
    const extracted = byRuleId.get(rule.id);
    const { complianceStatus, deduction, isCritical } = evaluateRuleWithExtraction(
      rule,
      extracted ?? null
    );
    totalDeduction += deduction;
    if (isCritical) hasCriticalViolation = true;

    const recommendation =
      complianceStatus === "VIOLATION"
        ? ((rule as { recommendation?: string }).recommendation ?? "Clause required by policy is missing or not detected.")
        : null;
    const findingData = {
      clauseType: rule.clauseType,
      complianceStatus,
      severity: rule.severity ?? undefined,
      riskType: rule.riskType ?? undefined,
      recommendation,
      foundText: extracted?.foundText ?? null,
      foundValue: extracted?.foundValue ?? undefined,
      confidence: extracted?.confidence ?? undefined,
      parseNotes: extracted?.notes ?? null,
      evaluatedAt,
      engineVersion: ENGINE_VERSION,
    };
    await clauseFindingRepo.upsertClauseFinding(contractVersionId, rule.id, findingData as Parameters<typeof clauseFindingRepo.upsertClauseFinding>[2]);
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
    const ext = byRuleId.get(r.id);
    const { complianceStatus } = evaluateRuleWithExtraction(r, ext ?? null);
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

function evaluateRuleWithExtraction(
  rule: {
    id: string;
    ruleType: PolicyRuleType;
    weight: number;
    severity: string | null;
    expectedValue: unknown;
    recommendation?: string;
  },
  extracted: ExtractionResult | null
): {
  complianceStatus: FindingComplianceStatus;
  deduction: number;
  isCritical: boolean;
} {
  const present = extracted?.present ?? false;
  const confidence = extracted?.confidence ?? 0;
  const foundValue = extracted?.foundValue;

  switch (rule.ruleType) {
    case "REQUIRED": {
      if (!present || confidence < CONFIDENCE_THRESHOLD) {
        return {
          complianceStatus: "VIOLATION",
          deduction: rule.weight,
          isCritical: rule.severity === "CRITICAL",
        };
      }
      return {
        complianceStatus: "COMPLIANT",
        deduction: 0,
        isCritical: false,
      };
    }
    case "FORBIDDEN": {
      if (present && confidence >= CONFIDENCE_THRESHOLD_FORBIDDEN) {
        return {
          complianceStatus: "VIOLATION",
          deduction: rule.weight,
          isCritical: rule.severity === "CRITICAL",
        };
      }
      return {
        complianceStatus: present ? "COMPLIANT" : "NOT_APPLICABLE",
        deduction: 0,
        isCritical: false,
      };
    }
    case "MIN_VALUE":
    case "MAX_VALUE":
    case "ALLOWED_VALUES": {
      if (!present) {
        return {
          complianceStatus: "VIOLATION",
          deduction: rule.weight,
          isCritical: rule.severity === "CRITICAL",
        };
      }
      if (foundValue == null || confidence < CONFIDENCE_THRESHOLD) {
        return {
          complianceStatus: "UNCLEAR",
          deduction: 0,
          isCritical: false,
        };
      }
      const expected = rule.expectedValue;
      if (rule.ruleType === "MIN_VALUE") {
        const numFound = toNumber(foundValue);
        const numExpected = toNumber(expected);
        if (numFound == null || numExpected == null) {
          return {
            complianceStatus: "UNCLEAR",
            deduction: 0,
            isCritical: false,
          };
        }
        const compliant = numFound >= numExpected;
        return {
          complianceStatus: compliant ? "COMPLIANT" : "VIOLATION",
          deduction: compliant ? 0 : rule.weight,
          isCritical: compliant ? false : rule.severity === "CRITICAL",
        };
      }
      if (rule.ruleType === "MAX_VALUE") {
        const numFound = toNumber(foundValue);
        const numExpected = toNumber(expected);
        if (numFound == null || numExpected == null) {
          return {
            complianceStatus: "UNCLEAR",
            deduction: 0,
            isCritical: false,
          };
        }
        const compliant = numFound <= numExpected;
        return {
          complianceStatus: compliant ? "COMPLIANT" : "VIOLATION",
          deduction: compliant ? 0 : rule.weight,
          isCritical: compliant ? false : rule.severity === "CRITICAL",
        };
      }
      // ALLOWED_VALUES: expected is array of allowed values
      const allowed = arrayFrom(expected);
      const foundStr = String(foundValue).trim();
      const compliant =
        allowed.length === 0 ||
        allowed.some((a) => String(a).trim().toLowerCase() === foundStr.toLowerCase());
      return {
        complianceStatus: compliant ? "COMPLIANT" : "VIOLATION",
        deduction: compliant ? 0 : rule.weight,
        isCritical: compliant ? false : rule.severity === "CRITICAL",
      };
    }
    default:
      return {
        complianceStatus: "NOT_APPLICABLE",
        deduction: 0,
        isCritical: false,
      };
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj.value === "number") return obj.value;
    if (typeof obj.amount === "number") return obj.amount;
    if (typeof obj.paymentDays === "number") return obj.paymentDays;
    if (typeof obj.noticeDays === "number") return obj.noticeDays;
  }
  return null;
}

function arrayFrom(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function scoreToStatus(score: number): ComplianceStatusType {
  if (score >= 80) return "COMPLIANT";
  if (score >= 50) return "NEEDS_REVIEW";
  return "NON_COMPLIANT";
}
