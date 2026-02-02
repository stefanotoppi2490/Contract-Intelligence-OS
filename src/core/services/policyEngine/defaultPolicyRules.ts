/**
 * Meaningful default policy rules for "Company Standard".
 * Idempotent: call once per policy; creates exactly these 7 rules.
 */

import { Prisma } from "@prisma/client";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";

const DEFAULT_RULES: Array<{
  clauseType: "LIABILITY" | "DATA_PRIVACY" | "GOVERNING_LAW" | "INTELLECTUAL_PROPERTY" | "TERMINATION" | "CONFIDENTIALITY" | "PAYMENT_TERMS";
  ruleType: "REQUIRED";
  severity: "LOW" | "MEDIUM" | "HIGH";
  riskType: "LEGAL" | "FINANCIAL" | "OPERATIONAL" | "DATA";
  weight: number;
  recommendation: string;
}> = [
  {
    clauseType: "LIABILITY",
    ruleType: "REQUIRED",
    severity: "HIGH",
    riskType: "FINANCIAL",
    weight: 25,
    recommendation: "Limit liability to a multiple of fees (e.g. 12 months).",
  },
  {
    clauseType: "DATA_PRIVACY",
    ruleType: "REQUIRED",
    severity: "HIGH",
    riskType: "DATA",
    weight: 15,
    recommendation: "Ensure GDPR-compliant data processing terms and DPA.",
  },
  {
    clauseType: "GOVERNING_LAW",
    ruleType: "REQUIRED",
    severity: "MEDIUM",
    riskType: "LEGAL",
    weight: 10,
    recommendation: "Restrict governing law to IT or EU jurisdictions.",
  },
  {
    clauseType: "INTELLECTUAL_PROPERTY",
    ruleType: "REQUIRED",
    severity: "MEDIUM",
    riskType: "LEGAL",
    weight: 10,
    recommendation: "Clarify IP ownership and usage rights.",
  },
  {
    clauseType: "TERMINATION",
    ruleType: "REQUIRED",
    severity: "MEDIUM",
    riskType: "OPERATIONAL",
    weight: 8,
    recommendation: "Ensure reasonable notice periods (15–30 days).",
  },
  {
    clauseType: "CONFIDENTIALITY",
    ruleType: "REQUIRED",
    severity: "LOW",
    riskType: "LEGAL",
    weight: 5,
    recommendation: "Include standard confidentiality obligations.",
  },
  {
    clauseType: "PAYMENT_TERMS",
    ruleType: "REQUIRED",
    severity: "LOW",
    riskType: "FINANCIAL",
    weight: 5,
    recommendation: "Define clear payment terms and timelines.",
  },
];

export async function seedDefaultPolicyRules(policyId: string): Promise<number> {
  for (const r of DEFAULT_RULES) {
    await policyRuleRepo.createPolicyRule({
      policy: { connect: { id: policyId } },
      clauseType: r.clauseType,
      ruleType: r.ruleType,
      expectedValue: Prisma.JsonNull,
      severity: r.severity,
      riskType: r.riskType,
      weight: r.weight,
      recommendation: r.recommendation,
    } as Prisma.PolicyRuleCreateInput);
  }
  return DEFAULT_RULES.length;
}
