/**
 * STEP 11: Deterministic Deal Desk decision engine.
 * Loads compliance, findings, exceptions; computes outcome (GO/NO_GO/NEEDS_REVIEW) and rationale. No AI.
 */

import type { DealDecisionOutcome } from "@prisma/client";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

export type DealDecisionPreview = {
  contractId: string;
  contractVersionId: string;
  policyId: string;
  effectiveScore: number;
  rawScore: number;
  outcome: DealDecisionOutcome;
  statusSuggestion: "DRAFT";
  counts: {
    violations: number;
    criticalViolations: number;
    unclear: number;
    overridden: number;
    openExceptions: number;
    approvedExceptions: number;
  };
  topDrivers: Array<{
    clauseType: string;
    riskType: string | null;
    severity: string | null;
    weight: number;
    status: string;
    recommendation: string | null;
  }>;
  rationaleMarkdown: string;
  /** Per riskType counts for report/UI. */
  riskTypeBreakdown: Record<string, { violations: number; unclear: number }>;
};

export async function computeDealDecisionPreview(
  contractId: string,
  contractVersionId: string,
  policyId: string
): Promise<DealDecisionPreview | null> {
  const [compliance, findings, approvedExceptions, allExceptions] = await Promise.all([
    contractComplianceRepo.findContractComplianceByVersionAndPolicy(contractVersionId, policyId),
    clauseFindingRepo.findManyClauseFindingsByContractVersion(contractVersionId, { include: { rule: true } }),
    exceptionRepo.findApprovedExceptionsByContractVersion(contractVersionId),
    exceptionRepo.findManyExceptionRequestsByContractVersion(contractVersionId, {
      select: { status: true, policyId: true },
    }),
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
    if (
      (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") &&
      overriddenFindingIds.has(f.id)
    ) {
      effectiveScore = Math.min(100, effectiveScore + weight);
    }
  }

  const violationFindings = policyFindings.filter(
    (f) => f.complianceStatus === "VIOLATION" && !overriddenFindingIds.has(f.id)
  );
  const criticalViolations = violationFindings.filter((f) => f.severity === "CRITICAL").length;
  const violations = violationFindings.length;
  const unclearFindings = policyFindings.filter((f) => f.complianceStatus === "UNCLEAR");
  const unclear = unclearFindings.length;
  const overridden = policyFindings.filter(
    (f) =>
      (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") &&
      overriddenFindingIds.has(f.id)
  ).length;
  const openExceptions = allExceptions.filter(
    (e) => e.status === "REQUESTED" && (e as { policyId?: string }).policyId === policyId
  ).length;
  const approvedExceptionsCount = approvedExceptions.length;

  let outcome: DealDecisionOutcome;
  if (criticalViolations > 0) outcome = "NO_GO";
  else if (effectiveScore < 60) outcome = "NO_GO";
  else if (violations > 0) outcome = "NEEDS_REVIEW";
  else if (unclear > 0) outcome = "NEEDS_REVIEW";
  else if (openExceptions > 0) outcome = "NEEDS_REVIEW";
  else outcome = "GO";

  const driversSource = policyFindings.filter(
    (f) => f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR"
  );
  const topDrivers = driversSource
    .sort((a, b) => (ruleWeightByFindingId.get(b.id) ?? 1) - (ruleWeightByFindingId.get(a.id) ?? 1))
    .slice(0, 5)
    .map((f) => ({
      clauseType: f.clauseType,
      riskType: f.riskType,
      severity: f.severity,
      weight: ruleWeightByFindingId.get(f.id) ?? 1,
      status: f.complianceStatus,
      recommendation: f.recommendation,
    }));

  const violationByRisk = new Map<string, string[]>();
  for (const f of violationFindings) {
    const rt = f.riskType ?? "OTHER";
    if (!violationByRisk.has(rt)) violationByRisk.set(rt, []);
    violationByRisk.get(rt)!.push(f.clauseType);
  }
  const unclearByRisk = new Map<string, string[]>();
  for (const f of unclearFindings) {
    const rt = f.riskType ?? "OTHER";
    if (!unclearByRisk.has(rt)) unclearByRisk.set(rt, []);
    unclearByRisk.get(rt)!.push(f.clauseType);
  }

  const lines: string[] = [];
  lines.push(`- Effective score: **${effectiveScore}/100** (raw ${compliance.score})`);
  if (violations > 0) {
    const parts = [...violationByRisk.entries()].map(([rt, types]) => `${rt}: ${types.join(", ")}`);
    lines.push(`- Violations: ${violations} (${parts.join("; ")})`);
  }
  if (criticalViolations > 0) lines.push(`- Critical violations: ${criticalViolations}`);
  if (unclear > 0) {
    const parts = [...unclearByRisk.entries()].map(([rt, types]) => `${rt}: ${types.join(", ")}`);
    lines.push(`- Unclear: ${unclear} (${parts.join("; ")})`);
  }
  lines.push(`- Approved exceptions: ${approvedExceptionsCount}`);
  lines.push(`- Open exception requests: ${openExceptions}`);
  if (topDrivers.length > 0) {
    lines.push("");
    lines.push("**Top drivers:**");
    for (const d of topDrivers) {
      lines.push(`- ${d.clauseType} (${d.riskType ?? "—"}): ${d.recommendation ?? d.status}`);
    }
  }
  const rationaleMarkdown = lines.join("\n");

  const riskTypeBreakdown: Record<string, { violations: number; unclear: number }> = {};
  for (const rt of [...violationByRisk.keys(), ...unclearByRisk.keys()]) {
    if (!riskTypeBreakdown[rt]) riskTypeBreakdown[rt] = { violations: 0, unclear: 0 };
    riskTypeBreakdown[rt].violations = violationByRisk.get(rt)?.length ?? 0;
    riskTypeBreakdown[rt].unclear = unclearByRisk.get(rt)?.length ?? 0;
  }

  return {
    contractId,
    contractVersionId,
    policyId,
    effectiveScore,
    rawScore: compliance.score,
    outcome,
    statusSuggestion: "DRAFT",
    counts: {
      violations,
      criticalViolations,
      unclear,
      overridden,
      openExceptions,
      approvedExceptions: approvedExceptionsCount,
    },
    topDrivers,
    rationaleMarkdown,
    riskTypeBreakdown,
  };
}
