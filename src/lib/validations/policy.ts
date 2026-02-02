import { z } from "zod";

const clauseTaxonomy = z.enum([
  "TERMINATION",
  "LIABILITY",
  "INTELLECTUAL_PROPERTY",
  "PAYMENT_TERMS",
  "DATA_PRIVACY",
  "CONFIDENTIALITY",
  "GOVERNING_LAW",
  "SLA",
  "SCOPE",
  "OTHER",
]);
const policyRuleType = z.enum(["REQUIRED", "FORBIDDEN", "MIN_VALUE", "MAX_VALUE", "ALLOWED_VALUES"]);
const severity = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const riskType = z.enum(["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"]);

export const createPolicySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  seedDefaults: z.boolean().optional().default(true),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const createPolicyRuleSchema = z.object({
  clauseType: clauseTaxonomy,
  ruleType: policyRuleType,
  expectedValue: z.union([z.string(), z.number(), z.record(z.unknown())]).optional().nullable(),
  severity: severity.optional().nullable(),
  riskType: riskType.optional().nullable(),
  weight: z.number().int().min(0).max(100).default(1),
  recommendation: z.string().min(1, "Recommendation is required").max(2000),
});

export type CreatePolicyRuleInput = z.infer<typeof createPolicyRuleSchema>;

export const updatePolicyRuleSchema = z.object({
  clauseType: clauseTaxonomy.optional(),
  ruleType: policyRuleType.optional(),
  expectedValue: z.union([z.string(), z.number(), z.record(z.unknown())]).optional().nullable(),
  severity: severity.optional().nullable(),
  riskType: riskType.optional().nullable(),
  weight: z.number().int().min(0).max(100).optional(),
  recommendation: z.string().min(1).max(2000).optional(),
});

export type UpdatePolicyRuleInput = z.infer<typeof updatePolicyRuleSchema>;
