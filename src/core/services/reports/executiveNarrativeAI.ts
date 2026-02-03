/**
 * STEP 9B: AI-generated executive narrative (presentation only).
 * AI receives ONLY structured summary data. No raw contract text, no extracted clauses.
 * Output is never persisted as source of truth.
 */

import { generateContent } from "@/core/services/ai/geminiClient";
import { buildExecutiveSummary } from "@/core/services/risk/executiveSummary";
import type { RiskAggregation } from "@/core/services/risk/riskAggregation";

export type ExecutiveNarrativeInput = {
  contractTitle: string;
  policyName: string;
  score: number;
  status: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
  violationCount: number;
  unclearCount: number;
  riskSummary: Array<{
    riskType: "LEGAL" | "FINANCIAL" | "DATA" | "OPERATIONAL" | "SECURITY";
    level: "OK" | "MEDIUM" | "NEEDS_REVIEW";
    violations: number;
    unclear: number;
  }>;
  keyRisks: string[];
};

const SYSTEM_PROMPT = `You are generating an executive-level risk summary for a business audience.

Use ONLY the structured data provided.
Do NOT invent facts.
Do NOT add legal advice.
Do NOT mention missing clauses or raw contract text.

The goal is to explain:
• overall risk posture
• why the contract requires or does not require review
• which risk areas are most relevant

Keep the tone professional, neutral, and concise.
Write one short paragraph (3–5 sentences max). Return only the paragraph text, no headings or labels.`;

const STATIC_NO_RISK =
  "This contract does not present material risks under the selected policy.";

/**
 * Build deterministic fallback narrative from STEP 9A summary (no AI).
 */
function buildFallbackNarrative(aggregation: RiskAggregation): string {
  const summary = buildExecutiveSummary(aggregation);
  const parts: string[] = [summary.headline];
  if (summary.paragraphs[0]) parts.push(summary.paragraphs[0]);
  return parts.join(" ");
}

/**
 * Map cluster level for AI input (spec uses OK | MEDIUM | NEEDS_REVIEW; we have HIGH -> MEDIUM).
 */
function levelForAI(level: string): "OK" | "MEDIUM" | "NEEDS_REVIEW" {
  if (level === "OK") return "OK";
  if (level === "HIGH" || level === "MEDIUM") return "MEDIUM";
  return "NEEDS_REVIEW";
}

/**
 * Generate executive narrative from strict structured input only.
 * If violationCount === 0 and unclearCount === 0, returns static sentence (no AI).
 * If AI fails, returns deterministic fallback from STEP 9A.
 */
export async function generateExecutiveNarrative(
  input: ExecutiveNarrativeInput,
  fallbackAggregation?: RiskAggregation | null
): Promise<string> {
  if (input.violationCount === 0 && input.unclearCount === 0) {
    return STATIC_NO_RISK;
  }

  const userPrompt = `Structured data (use only this):\n${JSON.stringify(input, null, 2)}`;
  const result = await generateContent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    expectJson: false,
  });

  if (result.ok && result.text?.trim()) {
    return result.text.trim();
  }

  if (fallbackAggregation) {
    return buildFallbackNarrative(fallbackAggregation);
  }

  return "Unable to generate narrative. Please review the risk summary above.";
}

/**
 * Build ExecutiveNarrativeInput from RiskAggregation + contract title and policy name.
 * Only structured data; no raw text or clauses.
 */
export function buildExecutiveNarrativeInput(
  aggregation: RiskAggregation,
  contractTitle: string,
  policyName: string
): ExecutiveNarrativeInput {
  const riskSummary = aggregation.clusters.map((c) => ({
    riskType: c.riskType,
    level: levelForAI(c.level),
    violations: c.violationCount,
    unclear: c.unclearCount,
  }));
  const keyRisks = aggregation.topDrivers.slice(0, 3).map((d) => `${d.clauseType}: ${d.reason}`);
  return {
    contractTitle,
    policyName,
    score: aggregation.effectiveScore,
    status: aggregation.overallStatus,
    violationCount: aggregation.clusters.reduce((s, c) => s + c.violationCount, 0),
    unclearCount: aggregation.clusters.reduce((s, c) => s + c.unclearCount, 0),
    riskSummary,
    keyRisks,
  };
}
