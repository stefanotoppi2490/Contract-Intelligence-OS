import { describe, it, expect } from "vitest";
import { computeDashboardRowAggregation } from "./dashboardAggregation";

describe("dashboardAggregation", () => {
  it("returns COMPLIANT when no violations or unclear", () => {
    const agg = computeDashboardRowAggregation(
      { score: 100, status: "COMPLIANT" },
      [],
      []
    );
    expect(agg.status).toBe("COMPLIANT");
    expect(agg.effectiveScore).toBe(100);
    expect(agg.violationCount).toBe(0);
    expect(agg.unclearCount).toBe(0);
    expect(agg.overriddenCount).toBe(0);
  });

  it("returns NEEDS_REVIEW when violations exist", () => {
    const agg = computeDashboardRowAggregation(
      { score: 80, status: "COMPLIANT" },
      [
        {
          id: "f1",
          complianceStatus: "VIOLATION",
          riskType: "LEGAL",
          rule: { policyId: "p1", weight: 5 },
        },
      ],
      []
    );
    expect(agg.status).toBe("NEEDS_REVIEW");
    expect(agg.effectiveScore).toBe(80);
    expect(agg.violationCount).toBe(1);
    expect(agg.riskTypeBreakdown.LEGAL.violations).toBe(1);
  });

  it("increases effectiveScore when violation is overridden by approved exception", () => {
    const agg = computeDashboardRowAggregation(
      { score: 75, status: "NEEDS_REVIEW" },
      [
        {
          id: "f1",
          complianceStatus: "VIOLATION",
          riskType: "LEGAL",
          rule: { policyId: "p1", weight: 5 },
        },
      ],
      [{ clauseFindingId: "f1" }]
    );
    expect(agg.effectiveScore).toBe(80);
    expect(agg.overriddenCount).toBe(1);
  });

  it("returns NON_COMPLIANT when effectiveScore < 60", () => {
    const agg = computeDashboardRowAggregation(
      { score: 50, status: "NON_COMPLIANT" },
      [],
      []
    );
    expect(agg.status).toBe("NON_COMPLIANT");
    expect(agg.effectiveScore).toBe(50);
  });
});
