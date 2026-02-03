/**
 * STEP 9A: Deterministic executive summary from RiskAggregation.
 * Template-based; no AI, no randomness.
 */

import type { RiskAggregation, RiskCluster } from "./riskAggregation";

export type ExecutiveSummary = {
  headline: string;
  paragraphs: string[];
  keyRisks: string[];
  recommendation: string;
};

const LEVEL_PRIORITY: Record<RiskCluster["level"], number> = {
  HIGH: 0,
  MEDIUM: 1,
  NEEDS_REVIEW: 2,
  OK: 3,
};

export function buildExecutiveSummary(aggregation: RiskAggregation): ExecutiveSummary {
  const { overallStatus, effectiveScore, rawScore, clusters, topDrivers } = aggregation;

  const headline =
    overallStatus === "COMPLIANT"
      ? "Contract compliant with company standards."
      : overallStatus === "NEEDS_REVIEW"
        ? "Contract requires review before approval."
        : "Contract is not compliant with company standards.";

  const paragraphs: string[] = [];
  paragraphs.push(
    `Overall status: ${overallStatus}. Effective score: ${effectiveScore}/100${effectiveScore !== rawScore ? ` (raw ${rawScore})` : ""}.`
  );

  const clustersWithIssues = clusters.filter((c) => c.level !== "OK");
  if (clustersWithIssues.length > 0) {
    const sorted = [...clustersWithIssues].sort(
      (a, b) => LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level] || b.totalWeight - a.totalWeight
    );
    const top1 = sorted[0];
    const top2 = sorted[1];
    const parts: string[] = [];
    if (top1) parts.push(`${top1.riskType}: ${top1.level} (${top1.violationCount} violation(s), ${top1.unclearCount} unclear).`);
    if (top2) parts.push(`${top2.riskType}: ${top2.level} (${top2.violationCount} violation(s), ${top2.unclearCount} unclear).`);
    if (parts.length) paragraphs.push(parts.join(" "));
  }

  const keyRisks = topDrivers.slice(0, 3).map((d) => `${d.clauseType}: ${d.reason}`);

  const recommendation =
    overallStatus === "NON_COMPLIANT"
      ? "Renegotiation or exception approval required."
      : overallStatus === "NEEDS_REVIEW"
        ? "Legal or risk review recommended."
        : "Contract can proceed to approval.";

  return {
    headline,
    paragraphs,
    keyRisks,
    recommendation,
  };
}
