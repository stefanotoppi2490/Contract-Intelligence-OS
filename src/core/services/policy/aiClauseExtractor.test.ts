import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractClauses } from "./aiClauseExtractor";

vi.mock("@/core/services/ai/geminiClient", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/core/services/ai/geminiClient";

describe("aiClauseExtractor", () => {
  beforeEach(() => {
    vi.mocked(generateContent).mockReset();
  });

  it("returns empty array when rules empty", async () => {
    const result = await extractClauses({
      contractText: "Any text",
      rules: [],
    });
    expect(result).toEqual([]);
    expect(vi.mocked(generateContent)).not.toHaveBeenCalled();
  });

  it("truncates contract to 40k chars and calls Gemini with JSON", async () => {
    const longText = "x".repeat(50_000);
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [],
    });

    await extractClauses({
      contractText: longText,
      rules: [{ ruleId: "r1", clauseType: "TERMINATION", ruleType: "REQUIRED", expectedValue: null }],
    });

    expect(vi.mocked(generateContent)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateContent).mock.calls[0][0];
    expect(call.userPrompt).toContain("x".repeat(40_000));
    expect(call.expectJson).toBe(true);
  });

  it("maps valid JSON array to extraction results", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [
        {
          ruleId: "r1",
          clauseType: "TERMINATION",
          present: true,
          foundText: "Either party may terminate with 30 days notice.",
          foundValue: { noticeDays: 30 },
          confidence: 0.9,
          notes: null,
        },
      ],
    });

    const result = await extractClauses({
      contractText: "Contract with termination clause.",
      rules: [{ ruleId: "r1", clauseType: "TERMINATION", ruleType: "REQUIRED", expectedValue: null }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ruleId: "r1",
      clauseType: "TERMINATION",
      present: true,
      foundText: "Either party may terminate with 30 days notice.",
      foundValue: { noticeDays: 30 },
      confidence: 0.9,
      notes: null,
    });
  });

  it("returns fallback (present=false, confidence=0) when Gemini fails", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: false,
      error: "API error",
    });

    const result = await extractClauses({
      contractText: "Short text",
      rules: [{ ruleId: "r1", clauseType: "LIABILITY", ruleType: "REQUIRED", expectedValue: null }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ruleId: "r1",
      present: false,
      confidence: 0,
      notes: "API error",
    });
  });

  it("caps foundText at 700 chars", async () => {
    const longExcerpt = "a".repeat(1000);
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [
        {
          ruleId: "r1",
          clauseType: "TERMINATION",
          present: true,
          foundText: longExcerpt,
          foundValue: null,
          confidence: 0.7,
          notes: null,
        },
      ],
    });

    const result = await extractClauses({
      contractText: "Text",
      rules: [{ ruleId: "r1", clauseType: "TERMINATION", ruleType: "REQUIRED", expectedValue: null }],
    });

    expect(result[0].foundText).toHaveLength(700);
    expect(result[0].foundText).toBe("a".repeat(700));
  });
});
