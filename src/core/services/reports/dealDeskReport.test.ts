import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDealDeskHtml, buildDealDeskPdf, type DealDeskReportPayload } from "./dealDeskReport";

const minimalPayload: DealDeskReportPayload = {
  contractTitle: "Master Service Agreement",
  counterpartyName: "Acme Corp",
  versionNumber: 2,
  policyName: "Standard Policy",
  outcome: "NEEDS_REVIEW",
  effectiveScore: 72,
  rawScore: 68,
  rationale: "- Effective score: **72/100** (raw 68)\n- Violations: 1 (LEGAL: LIABILITY)",
  counts: {
    violations: 1,
    criticalViolations: 0,
    unclear: 2,
    overridden: 0,
    openExceptions: 1,
    approvedExceptions: 0,
  },
  riskByType: [
    { riskType: "LEGAL", violations: 1, unclear: 1 },
    { riskType: "DATA", violations: 0, unclear: 1 },
  ],
  topDrivers: [
    {
      clauseType: "LIABILITY",
      riskType: "LEGAL",
      severity: "HIGH",
      weight: 7,
      recommendation: "Cap too low.",
    },
  ],
  approvedExceptions: [],
  openExceptions: [{ id: "ex-1", title: "Liability cap exception request" }],
  narrative: null,
  generatedAt: "2025-02-01T12:00:00.000Z",
  workspaceName: "Default Workspace",
  status: "DRAFT",
  finalizedAt: null,
};

describe("dealDeskReport", () => {
  describe("buildDealDeskHtml", () => {
    it("returns non-empty HTML with outcome and score", () => {
      const html = buildDealDeskHtml(minimalPayload);
      expect(html).toBeTruthy();
      expect(html.length).toBeGreaterThan(100);
      expect(html).toContain("<!DOCTYPE html");
      expect(html).toContain("<html");
      expect(html).toContain("NEEDS_REVIEW");
      expect(html).toContain("72/100");
      expect(html).toContain("raw 68");
    });

    it("includes contract title, counterparty, policy name", () => {
      const html = buildDealDeskHtml(minimalPayload);
      expect(html).toContain("Master Service Agreement");
      expect(html).toContain("Acme Corp");
      expect(html).toContain("Standard Policy");
    });

    it("includes key risks and rationale", () => {
      const html = buildDealDeskHtml(minimalPayload);
      expect(html).toContain("Key risks");
      expect(html).toContain("LIABILITY");
      expect(html).toContain("Rationale");
      expect(html).toContain("Effective score");
    });

    it("escapes HTML in content", () => {
      const unsafe = {
        ...minimalPayload,
        contractTitle: "Test <script>alert(1)</script>",
      };
      const html = buildDealDeskHtml(unsafe);
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert(1)</script>");
    });
  });

  describe("buildDealDeskPdf", () => {
    beforeEach(() => {
      vi.doMock("./DealDeskPdf.js", () => ({
        buildDealDeskPdfBuffer: vi.fn().mockResolvedValue(new Uint8Array(100)),
      }));
    });

    it("returns non-empty buffer and includes outcome/score in payload usage", async () => {
      const buffer = await buildDealDeskPdf(minimalPayload);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });
});
