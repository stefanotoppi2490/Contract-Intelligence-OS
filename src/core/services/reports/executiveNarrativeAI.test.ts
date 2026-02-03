import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateExecutiveNarrative,
  buildExecutiveNarrativeInput,
  type ExecutiveNarrativeInput,
} from "./executiveNarrativeAI";
import type { RiskAggregation } from "@/core/services/risk/riskAggregation";

vi.mock("@/core/services/ai/geminiClient");

import { generateContent } from "@/core/services/ai/geminiClient";

describe("executiveNarrativeAI", () => {
  beforeEach(() => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "This contract presents moderate risk and requires legal review before approval.",
    });
  });

  describe("buildExecutiveNarrativeInput", () => {
    it("builds input from aggregation with only structured data (no raw text)", () => {
      const aggregation: RiskAggregation = {
        contractId: "c-1",
        contractVersionId: "v-1",
        policyId: "p-1",
        overallStatus: "NEEDS_REVIEW",
        rawScore: 72,
        effectiveScore: 75,
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
        generatedAt: new Date().toISOString(),
      };
      const input = buildExecutiveNarrativeInput(aggregation, "My Contract", "Standard Policy");
      expect(input.contractTitle).toBe("My Contract");
      expect(input.policyName).toBe("Standard Policy");
      expect(input.score).toBe(75);
      expect(input.status).toBe("NEEDS_REVIEW");
      expect(input.violationCount).toBe(1);
      expect(input.unclearCount).toBe(0);
      expect(input.riskSummary).toHaveLength(1);
      expect(input.riskSummary[0].riskType).toBe("LEGAL");
      expect(input.riskSummary[0].level).toBe("MEDIUM");
      expect(input.riskSummary[0].violations).toBe(1);
      expect(input.keyRisks).toContain("TERMINATION: Clause required.");
      expect(JSON.stringify(input)).not.toMatch(/raw contract|extracted clause|clause text/i);
    });

    it("maps HIGH cluster level to MEDIUM for AI input", () => {
      const aggregation: RiskAggregation = {
        contractId: "c-1",
        contractVersionId: "v-1",
        policyId: "p-1",
        overallStatus: "NON_COMPLIANT",
        rawScore: 50,
        effectiveScore: 50,
        clusters: [
          {
            riskType: "LEGAL",
            level: "HIGH",
            violationCount: 2,
            unclearCount: 0,
            overriddenCount: 0,
            maxSeverity: "CRITICAL",
            totalWeight: 15,
            topDrivers: [],
          },
        ],
        topDrivers: [],
        generatedAt: new Date().toISOString(),
      };
      const input = buildExecutiveNarrativeInput(aggregation, "C", "P");
      expect(input.riskSummary[0].level).toBe("MEDIUM");
    });
  });

  describe("generateExecutiveNarrative", () => {
    it("skips AI and returns static sentence when violationCount and unclearCount are 0", async () => {
      const input: ExecutiveNarrativeInput = {
        contractTitle: "C",
        policyName: "P",
        score: 100,
        status: "COMPLIANT",
        violationCount: 0,
        unclearCount: 0,
        riskSummary: [{ riskType: "LEGAL", level: "OK", violations: 0, unclear: 0 }],
        keyRisks: [],
      };
      const narrative = await generateExecutiveNarrative(input);
      expect(narrative).toBe("This contract does not present material risks under the selected policy.");
      expect(generateContent).not.toHaveBeenCalled();
    });

    it("calls AI with structured input only (no raw text)", async () => {
      const input: ExecutiveNarrativeInput = {
        contractTitle: "Contract A",
        policyName: "Policy B",
        score: 72,
        status: "NEEDS_REVIEW",
        violationCount: 1,
        unclearCount: 0,
        riskSummary: [{ riskType: "LEGAL", level: "MEDIUM", violations: 1, unclear: 0 }],
        keyRisks: ["TERMINATION: Clause required."],
      };
      await generateExecutiveNarrative(input);
      expect(generateContent).toHaveBeenCalledTimes(1);
      const call = vi.mocked(generateContent).mock.calls[0][0];
      expect(call.userPrompt).toContain("Structured data");
      expect(call.userPrompt).toContain("Contract A");
      expect(call.userPrompt).toContain("Policy B");
      expect(call.userPrompt).toContain("NEEDS_REVIEW");
      expect(call.userPrompt).toContain("TERMINATION: Clause required.");
      expect(call.userPrompt).not.toMatch(/raw contract|extracted|clause text|contract text/i);
    });

    it("returns fallback when AI fails and fallbackAggregation provided", async () => {
      vi.mocked(generateContent).mockResolvedValue({ ok: false, error: "API error" });
      const input: ExecutiveNarrativeInput = {
        contractTitle: "C",
        policyName: "P",
        score: 70,
        status: "NEEDS_REVIEW",
        violationCount: 1,
        unclearCount: 0,
        riskSummary: [{ riskType: "LEGAL", level: "MEDIUM", violations: 1, unclear: 0 }],
        keyRisks: [],
      };
      const fallbackAggregation: RiskAggregation = {
        contractId: "c-1",
        contractVersionId: "v-1",
        policyId: "p-1",
        overallStatus: "NEEDS_REVIEW",
        rawScore: 70,
        effectiveScore: 70,
        clusters: [],
        topDrivers: [],
        generatedAt: new Date().toISOString(),
      };
      const narrative = await generateExecutiveNarrative(input, fallbackAggregation);
      expect(narrative).toContain("Contract requires review before approval.");
      expect(narrative).toContain("NEEDS_REVIEW");
    });

    it("returns error message when AI fails and no fallback", async () => {
      vi.mocked(generateContent).mockResolvedValue({ ok: false, error: "API error" });
      const input: ExecutiveNarrativeInput = {
        contractTitle: "C",
        policyName: "P",
        score: 70,
        status: "NEEDS_REVIEW",
        violationCount: 1,
        unclearCount: 0,
        riskSummary: [{ riskType: "LEGAL", level: "MEDIUM", violations: 1, unclear: 0 }],
        keyRisks: [],
      };
      const narrative = await generateExecutiveNarrative(input);
      expect(narrative).toContain("Unable to generate narrative");
    });
  });
});
