import { describe, it, expect } from "vitest";
import { buildCompareReportHtml } from "./versionCompareReport";
import type { VersionCompareResult } from "@/core/services/compare/versionCompare";

const sampleResult: VersionCompareResult = {
  from: {
    versionId: "v-1",
    versionNumber: 1,
    rawScore: 80,
    effectiveScore: 80,
  },
  to: {
    versionId: "v-2",
    versionNumber: 2,
    rawScore: 85,
    effectiveScore: 85,
  },
  delta: {
    raw: 5,
    effective: 5,
    label: "IMPROVED",
  },
  changes: [
    {
      key: "TERMINATION_NOTICE",
      clauseType: "TERMINATION_NOTICE",
      changeType: "MODIFIED",
      from: { status: "VIOLATION", overridden: false, foundValue: { noticeDays: 5 } },
      to: { status: "COMPLIANT", overridden: false, foundValue: { noticeDays: 30 } },
      why: "Compliance changed: VIOLATION → COMPLIANT",
      weight: 3,
      severity: null,
      riskType: null,
    },
  ],
  topDrivers: [
    { clauseType: "TERMINATION_NOTICE", key: "TERMINATION_NOTICE", deltaImpact: 3, reason: "Improved" },
  ],
};

describe("versionCompareReport", () => {
  it("returns non-empty HTML", () => {
    const html = buildCompareReportHtml(sampleResult, {
      contractTitle: "Test Contract",
      policyName: "Test Policy",
      workspaceName: "Workspace",
    });
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("<html");
    expect(html).toContain("</body>");
  });

  it("includes delta label in output", () => {
    const html = buildCompareReportHtml(sampleResult, {
      contractTitle: "Test Contract",
      policyName: "Test Policy",
    });
    expect(html).toContain("IMPROVED");
    expect(html).toContain("Delta:");
    expect(html).toContain("5 (raw)");
    expect(html).toContain("5 (effective)");
  });

  it("includes contract title and policy name", () => {
    const html = buildCompareReportHtml(sampleResult, {
      contractTitle: "My Contract",
      policyName: "My Policy",
      workspaceName: "My Workspace",
    });
    expect(html).toContain("My Contract");
    expect(html).toContain("My Policy");
    expect(html).toContain("My Workspace");
  });

  it("escapes HTML in content", () => {
    const resultWithXss: VersionCompareResult = {
      ...sampleResult,
      changes: [
        {
          ...sampleResult.changes[0]!,
          clauseType: "<script>alert(1)</script>",
          why: "Test & value",
        },
      ],
    };
    const html = buildCompareReportHtml(resultWithXss, {
      contractTitle: "<b>Title</b>",
      policyName: "Policy",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });
});
