/**
 * STEP 5B: AI clause extraction with strict JSON output.
 * NEVER judges compliance. Extracts clause presence + values only.
 * Uses Gemini; contract text truncated to MAX_CONTRACT_CHARS.
 */

import type { ClauseTaxonomy } from "@prisma/client";
import { generateContent } from "@/core/services/ai/geminiClient";

const MAX_CONTRACT_CHARS = 40_000;
const MAX_FOUND_TEXT_CHARS = 700;

export type RuleInput = {
  ruleId: string;
  clauseType: ClauseTaxonomy;
  ruleType: string;
  expectedValue: unknown;
};

export type ExtractionResult = {
  ruleId: string;
  clauseType: ClauseTaxonomy;
  present: boolean;
  foundText: string | null;
  foundValue: string | number | object | null;
  confidence: number;
  notes: string | null;
};

const SYSTEM_PROMPT = `You are a contract clause extractor. Output STRICTLY valid JSON only. No markdown, no commentary.

Rules:
- NEVER judge compliance. Only extract presence and values.
- NEVER invent clause text. If a clause is not found in the contract, set present=false and foundText=null.
- foundText MUST be a short excerpt copied verbatim from the contract (max ${MAX_FOUND_TEXT_CHARS} characters).
- If present=true but you cannot parse a structured value, set foundValue=null and confidence <= 0.6 with notes explaining.
- Confidence: 0-1. Use high confidence (>=0.7) only when you have a clear excerpt and parsed value. Use <=0.6 when uncertain or value unparseable.
- Return an array of objects, one per ruleId, with: ruleId, clauseType, present (boolean), foundText (string|null), foundValue (object|number|string|null), confidence (number), notes (string|null).`;

function buildValueSchemaHint(clauseType: string): string {
  const hints: Record<string, string> = {
    LIABILITY:
      "foundValue: { capAmount?, capUnit?, capMultipleMonths?, unlimited? }",
    TERMINATION:
      "foundValue: { noticeDays?, noticeBusinessDays?, terminationForConvenience? }",
    GOVERNING_LAW: "foundValue: { lawCountry?, venue? }",
    PAYMENT_TERMS: "foundValue: { paymentDays?, trigger? }",
    CONFIDENTIALITY:
      "foundValue: { durationMonths?, durationYears?, indefinite? }",
    DATA_PRIVACY:
      "foundValue: { mentionsGDPR?, dpaMentioned?, breachNoticeHours? }",
    INTELLECTUAL_PROPERTY:
      "foundValue: { ownership?, assignment? }",
  };
  return hints[clauseType] ?? "foundValue: object or null";
}

export type ExtractClausesInput = {
  contractText: string;
  rules: RuleInput[];
};

/**
 * Extract clause presence and values from contract text using Gemini.
 * Contract text is truncated to MAX_CONTRACT_CHARS; notes will mention if truncated.
 * Returns one result per rule; on API/parse failure returns fallback (all present=false, confidence=0).
 */
export async function extractClauses(
  input: ExtractClausesInput
): Promise<ExtractionResult[]> {
  const { contractText, rules } = input;
  if (rules.length === 0) return [];

  const truncated =
    contractText.length > MAX_CONTRACT_CHARS
      ? contractText.slice(0, MAX_CONTRACT_CHARS)
      : contractText;
  const wasTruncated = contractText.length > MAX_CONTRACT_CHARS;
  const truncNote = wasTruncated
    ? ` (Contract truncated to ${MAX_CONTRACT_CHARS} chars for analysis.)`
    : "";

  const rulesDescription = rules
    .map(
      (r) =>
        `- ruleId: "${r.ruleId}", clauseType: ${r.clauseType}, ruleType: ${r.ruleType}. Extract: ${buildValueSchemaHint(r.clauseType)}`
    )
    .join("\n");

  const userPrompt = `Contract text to analyze:${truncNote}

\`\`\`
${truncated}
\`\`\`

Rules to extract (return one result per ruleId):
${rulesDescription}

Return a JSON array of objects with exactly: ruleId (string), clauseType (string), present (boolean), foundText (string or null, max ${MAX_FOUND_TEXT_CHARS} chars excerpt), foundValue (object/number/string or null), confidence (number 0-1), notes (string or null). No other fields.`;

  const result = await generateContent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
  });

  if (!result.ok || result.json == null) {
    return rules.map((r) => ({
      ruleId: r.ruleId,
      clauseType: r.clauseType,
      present: false,
      foundText: null,
      foundValue: null,
      confidence: 0,
      notes: result.ok ? null : result.error,
    }));
  }

  let arr: unknown[] = [];
  if (Array.isArray(result.json)) {
    arr = result.json;
  } else if (
    typeof result.json === "object" &&
    result.json !== null &&
    "results" in result.json &&
    Array.isArray((result.json as { results: unknown[] }).results)
  ) {
    arr = (result.json as { results: unknown[] }).results;
  }

  const byRuleId = new Map<string, ExtractionResult>();
  for (const item of arr) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const ruleId = typeof o.ruleId === "string" ? o.ruleId : null;
    if (!ruleId) continue;
    const clauseType = (o.clauseType as ClauseTaxonomy) ?? "OTHER";
    const present = Boolean(o.present);
    let foundText: string | null = null;
    if (typeof o.foundText === "string") {
      foundText = o.foundText.slice(0, MAX_FOUND_TEXT_CHARS);
    }
    let foundValue: string | number | object | null = null;
    if (o.foundValue !== undefined && o.foundValue !== null) {
      if (
        typeof o.foundValue === "string" ||
        typeof o.foundValue === "number" ||
        (typeof o.foundValue === "object" && !Array.isArray(o.foundValue))
      ) {
        foundValue = o.foundValue as string | number | object;
      }
    }
    let confidence = typeof o.confidence === "number" ? o.confidence : 0;
    confidence = Math.max(0, Math.min(1, confidence));
    const notes =
      typeof o.notes === "string" ? o.notes : (o.notes as string) ?? null;

    byRuleId.set(ruleId, {
      ruleId,
      clauseType,
      present,
      foundText,
      foundValue,
      confidence,
      notes,
    });
  }

  return rules.map((r) => {
    const extracted = byRuleId.get(r.ruleId);
    if (extracted) return extracted;
    return {
      ruleId: r.ruleId,
      clauseType: r.clauseType,
      present: false,
      foundText: null,
      foundValue: null,
      confidence: 0,
      notes: "No extraction result for this rule",
    };
  });
}
