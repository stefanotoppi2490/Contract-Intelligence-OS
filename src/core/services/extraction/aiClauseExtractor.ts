/**
 * STEP 8A: Neutral AI clause extraction. Evidence-based only; NO compliance, violations, or score.
 * One extraction per clauseType max; skip if clause not found.
 */

import type { ClauseTaxonomy } from "@prisma/client";
import { generateContent } from "@/core/services/ai/geminiClient";

const MAX_CONTRACT_CHARS = 40_000;
const MAX_EXTRACTED_TEXT_CHARS = 700;

const CLAUSE_TYPES: ClauseTaxonomy[] = [
  "TERMINATION",
  "LIABILITY",
  "INTELLECTUAL_PROPERTY",
  "PAYMENT_TERMS",
  "DATA_PRIVACY",
  "CONFIDENTIALITY",
  "GOVERNING_LAW",
  "SLA",
  "SCOPE",
  "OTHER",
];

export type NeutralExtractionItem = {
  clauseType: ClauseTaxonomy;
  extractedValue: unknown;
  extractedText: string | null;
  confidence: number;
  sourceLocation?: { page?: number; paragraph?: number; offsets?: unknown } | null;
};

const SYSTEM_PROMPT = `You are a contract clause extractor. Output STRICTLY valid JSON only. No markdown, no commentary.

Rules:
- NEVER judge compliance or violations. Only extract evidence: presence, value, and direct quote.
- Return ONLY clauses you actually find in the contract. If a clause type is not present, do NOT include it.
- extractedText MUST be a short excerpt copied verbatim from the contract (max ${MAX_EXTRACTED_TEXT_CHARS} characters).
- extractedValue must be structured when possible (e.g. { noticeDays: 30 }, { capAmount: 1000000 }, { lawCountry: "UK" }).
- confidence: 0-1. Use high (>=0.7) only when you have a clear quote and parsed value; use <=0.6 when uncertain.
- Return a JSON array of objects. Each object: clauseType (string, one of: ${CLAUSE_TYPES.join(", ")}), extractedValue (object/number/string or null), extractedText (string or null, direct quote), confidence (number), sourceLocation (optional: { page?, paragraph?, offsets? } or null).`;

/**
 * Extract neutral clause data from contract full text. No policy, no compliance.
 * Returns at most one item per clauseType; only for clauses found. On API/parse failure returns [].
 */
export async function extractClausesNeutral(fullText: string): Promise<NeutralExtractionItem[]> {
  const truncated =
    fullText.length > MAX_CONTRACT_CHARS ? fullText.slice(0, MAX_CONTRACT_CHARS) : fullText;
  const truncNote =
    fullText.length > MAX_CONTRACT_CHARS
      ? ` (Contract truncated to ${MAX_CONTRACT_CHARS} chars.)`
      : "";

  const userPrompt = `Contract text to analyze:${truncNote}

\`\`\`
${truncated}
\`\`\`

Extract each clause type you find. Return a JSON array of objects with: clauseType, extractedValue, extractedText, confidence, sourceLocation (optional). Include ONLY clauses that appear in the contract. No other fields.`;

  const result = await generateContent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  if (!result.ok || result.json == null) {
    return [];
  }

  let arr: unknown[] = [];
  if (Array.isArray(result.json)) {
    arr = result.json;
  } else if (
    typeof result.json === "object" &&
    result.json !== null &&
    "extractions" in result.json &&
    Array.isArray((result.json as { extractions: unknown[] }).extractions)
  ) {
    arr = (result.json as { extractions: unknown[] }).extractions;
  }

  const byClauseType = new Map<ClauseTaxonomy, NeutralExtractionItem>();
  for (const item of arr) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const clauseTypeRaw = o.clauseType;
    const clauseType = CLAUSE_TYPES.includes(clauseTypeRaw as ClauseTaxonomy)
      ? (clauseTypeRaw as ClauseTaxonomy)
      : "OTHER";
    if (byClauseType.has(clauseType)) continue;

    const extractedText =
      typeof o.extractedText === "string"
        ? o.extractedText.slice(0, MAX_EXTRACTED_TEXT_CHARS)
        : null;
    const extractedValue =
      o.extractedValue !== undefined && o.extractedValue !== null ? o.extractedValue : null;
    let confidence = typeof o.confidence === "number" ? o.confidence : 0;
    confidence = Math.max(0, Math.min(1, confidence));

    const sourceLocation =
      o.sourceLocation != null && typeof o.sourceLocation === "object"
        ? (o.sourceLocation as NeutralExtractionItem["sourceLocation"])
        : null;

    byClauseType.set(clauseType, {
      clauseType,
      extractedValue,
      extractedText,
      confidence,
      sourceLocation,
    });
  }

  return Array.from(byClauseType.values());
}
