/**
 * STEP 8A: Tests for neutral AI clause extraction. No policy/compliance logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractClausesNeutral } from "./aiClauseExtractor";

vi.mock("@/core/services/ai/geminiClient", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "@/core/services/ai/geminiClient";

describe("extractClausesNeutral", () => {
  beforeEach(() => {
    vi.mocked(generateContent).mockReset();
  });

  it("returns only clauses that were found (missing clauses are skipped)", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [
        { clauseType: "TERMINATION", extractedValue: { noticeDays: 30 }, extractedText: "Either party may terminate with 30 days notice.", confidence: 0.9 },
        { clauseType: "LIABILITY", extractedValue: { capAmount: 1000000 }, extractedText: "Liability is capped at $1,000,000.", confidence: 0.85 },
      ],
    });
    const result = await extractClausesNeutral("Contract text here.");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.clauseType)).toEqual(["TERMINATION", "LIABILITY"]);
    expect(result[0].extractedValue).toEqual({ noticeDays: 30 });
    expect(result[0].extractedText).toContain("30 days notice");
    expect(result[1].extractedValue).toEqual({ capAmount: 1000000 });
  });

  it("clamps confidence to 0–1", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [
        { clauseType: "TERMINATION", extractedValue: null, extractedText: "Termination clause.", confidence: 1.5 },
        { clauseType: "LIABILITY", extractedValue: null, extractedText: "Liability clause.", confidence: -0.2 },
      ],
    });
    const result = await extractClausesNeutral("Contract.");
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.clauseType === "TERMINATION")!.confidence).toBe(1);
    expect(result.find((r) => r.clauseType === "LIABILITY")!.confidence).toBe(0);
  });

  it("keeps at most one extraction per clauseType (first wins)", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [
        { clauseType: "TERMINATION", extractedValue: { noticeDays: 30 }, extractedText: "First.", confidence: 0.9 },
        { clauseType: "TERMINATION", extractedValue: { noticeDays: 60 }, extractedText: "Second.", confidence: 0.8 },
      ],
    });
    const result = await extractClausesNeutral("Contract.");
    expect(result).toHaveLength(1);
    expect(result[0].clauseType).toBe("TERMINATION");
    expect(result[0].extractedValue).toEqual({ noticeDays: 30 });
  });

  it("returns [] when API fails or JSON invalid", async () => {
    vi.mocked(generateContent).mockResolvedValue({ ok: false, error: "API error" });
    const result = await extractClausesNeutral("Contract.");
    expect(result).toEqual([]);
  });

  it("returns [] when json is null", async () => {
    vi.mocked(generateContent).mockResolvedValue({ ok: true, text: "[]", json: null });
    const result = await extractClausesNeutral("Contract.");
    expect(result).toEqual([]);
  });

  it("accepts extractions wrapper object", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "{}",
      json: {
        extractions: [
          { clauseType: "GOVERNING_LAW", extractedValue: { lawCountry: "UK" }, extractedText: "Governed by English law.", confidence: 0.88 },
        ],
      },
    });
    const result = await extractClausesNeutral("Contract.");
    expect(result).toHaveLength(1);
    expect(result[0].clauseType).toBe("GOVERNING_LAW");
    expect(result[0].confidence).toBe(0.88);
  });

  it("truncates extractedText to max length", async () => {
    const longQuote = "A".repeat(1000);
    vi.mocked(generateContent).mockResolvedValue({
      ok: true,
      text: "[]",
      json: [
        { clauseType: "OTHER", extractedValue: null, extractedText: longQuote, confidence: 0.5 },
      ],
    });
    const result = await extractClausesNeutral("Contract.");
    expect(result[0].extractedText!.length).toBeLessThanOrEqual(700);
  });
});
