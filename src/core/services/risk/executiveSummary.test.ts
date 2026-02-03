import { describe, it, expect } from "vitest";
import { buildExecutiveSummary } from "./executiveSummary";
import type { RiskAggregation } from "./riskAggregation";

function makeAggregation(overrides: Partial<RiskAggregation>): RiskAggregation {
  return {
    contractId: "c-1",
    contractVersionId: "v-1",
    policyId: "p-1",
    overallStatus: "COMPLIANT",
    rawScore: 100,
    effectiveScore: 100,
    clusters: [],
    topDrivers: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildExecutiveSummary", () => {
  it("headline matches overallStatus: COMPLIANT", () => {
    const agg = makeAggregation({ overallStatus: "COMPLIANT" });
    const summary = buildExecutiveSummary(agg);
    expect(summary.headline).toBe("Contract compliant with company standards.");
  });

  it("headline matches overallStatus: NEEDS_REVIEW", () => {
    const agg = makeAggregation({ overallStatus: "NEEDS_REVIEW" });
    const summary = buildExecutiveSummary(agg);
    expect(summary.headline).toBe("Contract requires review before approval.");
  });

  it("headline matches overallStatus: NON_COMPLIANT", () => {
    const agg = makeAggregation({ overallStatus: "NON_COMPLIANT" });
    const summary = buildExecutiveSummary(agg);
    expect(summary.headline).toBe("Contract is not compliant with company standards.");
  });

  it("deterministic output for same input", () => {
    const agg = makeAggregation({
      overallStatus: "NEEDS_REVIEW",
      effectiveScore: 72,
      rawScore: 70,
      clusters: [
        {
          riskType: "LEGAL",
          level: "MEDIUM",
          violationCount: 1,
          unclearCount: 0,
          overriddenCount: 0,
          maxSeverity: "HIGH",
          totalWeight: 5,
          topDrivers: [{ clauseType: "TERMINATION", severity: "HIGH", weight: 5, reason: "Clause required." }],
        },
      ],
      topDrivers: [{ clauseType: "TERMINATION", severity: "HIGH", weight: 5, reason: "Clause required." }],
    });
    const a = buildExecutiveSummary(agg);
    const b = buildExecutiveSummary(agg);
    expect(a).toEqual(b);
    expect(a.paragraphs[0]).toContain("NEEDS_REVIEW");
    expect(a.paragraphs[0]).toContain("72");
    expect(a.recommendation).toBe("Legal or risk review recommended.");
  });

  it("recommendation: NON_COMPLIANT → renegotiation", () => {
    const agg = makeAggregation({ overallStatus: "NON_COMPLIANT" });
    const summary = buildExecutiveSummary(agg);
    expect(summary.recommendation).toBe("Renegotiation or exception approval required.");
  });

  it("recommendation: COMPLIANT → proceed to approval", () => {
    const agg = makeAggregation({ overallStatus: "COMPLIANT" });
    const summary = buildExecutiveSummary(agg);
    expect(summary.recommendation).toBe("Contract can proceed to approval.");
  });
});
