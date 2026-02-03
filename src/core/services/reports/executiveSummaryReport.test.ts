/**
 * STEP 9C: Tests for executive summary report builders (MD / HTML).
 */

import { describe, it, expect } from "vitest";
import {
  buildExecutiveMarkdown,
  buildExecutiveHtml,
  type ExecutiveExportModel,
} from "./executiveSummaryReport";

const minimalModel: ExecutiveExportModel = {
  contractTitle: "Master Service Agreement",
  counterpartyName: "Acme Corp",
  contractType: "MSA",
  startDate: "2024-01-01",
  endDate: "2025-12-31",
  versionNumber: 2,
  policyName: "Standard Compliance",
  decision: "NEEDS_REVIEW",
  overallStatus: "NEEDS_REVIEW",
  rawScore: 72,
  effectiveScore: 75,
  clusters: [
    { riskType: "LEGAL", level: "MEDIUM", violations: 2, unclear: 1 },
    { riskType: "FINANCIAL", level: "OK", violations: 0, unclear: 0 },
  ],
  keyRisks: [
    "Limitation of liability: cap below policy minimum",
    "Indemnity: carve-outs missing",
  ],
  exceptions: { count: 1, items: [{ id: "ex-1", title: "Liability cap exception" }] },
  narrative: null,
  generatedAt: "2025-02-01T12:00:00.000Z",
  workspaceName: "Default Workspace",
};

describe("executiveSummaryReport", () => {
  describe("buildExecutiveMarkdown", () => {
    it("contains contract title, score, and decision", () => {
      const md = buildExecutiveMarkdown(minimalModel);
      expect(md).toContain("Master Service Agreement");
      expect(md).toContain("75/100");
      expect(md).toContain("raw 72");
      expect(md).toContain("## NEEDS_REVIEW");
    });

    it("includes key risks as list items", () => {
      const md = buildExecutiveMarkdown(minimalModel);
      expect(md).toContain("### Key risks");
      expect(md).toContain("Limitation of liability: cap below policy minimum");
      expect(md).toContain("Indemnity: carve-outs missing");
    });

    it("includes approved exceptions when present", () => {
      const md = buildExecutiveMarkdown(minimalModel);
      expect(md).toContain("### Approved exceptions");
      expect(md).toContain("Liability cap exception");
    });

    it("omits AI narrative section when narrative is null", () => {
      const md = buildExecutiveMarkdown(minimalModel);
      expect(md).not.toContain("AI-generated narrative");
    });

    it("includes AI narrative section when narrative is set", () => {
      const withNarrative = { ...minimalModel, narrative: "Summary text here." };
      const md = buildExecutiveMarkdown(withNarrative);
      expect(md).toContain("### AI-generated narrative (from structured risk data)");
      expect(md).toContain("Summary text here.");
    });
  });

  describe("buildExecutiveHtml", () => {
    it("contains key risks as list items", () => {
      const html = buildExecutiveHtml(minimalModel);
      expect(html).toContain("<h3>Key risks</h3>");
      expect(html).toContain("<li>Limitation of liability: cap below policy minimum</li>");
      expect(html).toContain("<li>Indemnity: carve-outs missing</li>");
    });

    it("contains contract title, score, and decision", () => {
      const html = buildExecutiveHtml(minimalModel);
      expect(html).toContain("Master Service Agreement");
      expect(html).toContain("75/100");
      expect(html).toContain("NEEDS_REVIEW");
    });

    it("escapes HTML in user content", () => {
      const unsafe = { ...minimalModel, contractTitle: "Test <script>alert(1)</script>" };
      const html = buildExecutiveHtml(unsafe);
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert(1)</script>");
    });
  });
});
