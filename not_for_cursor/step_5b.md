Implement STEP 5B: AI-assisted Clause Extraction (Gemini 3.5) with strict JSON output and confidence, then feed into deterministic Policy Engine.

Context:

- STEP 5A done: Policies + PolicyRules editable, deterministic scoring + findings.
- STEP 4 done: ContractVersionText.text is available (TEXT_READY) or ERROR.
- Gemini 3.5 will be used as LLM.
- Requirement: AI must ONLY extract clause presence + values. Compliance logic stays deterministic.

────────────────────────────────

1. DATA MODEL CHANGES (minimal)
   ────────────────────────────────
   Extend ClauseFinding to store AI extraction:

- foundText (string | null) // excerpt from contract
- foundValue (string | number | object | null) // parsed value
- confidence (number 0..1)
- parseNotes (string | null)

If these already exist on ClauseFinding, just use them.

Also store:

- evaluatedAt (timestamp) optional
- engineVersion (string) optional (e.g. "5b-1") for reproducibility

──────────────────────────────── 2) CLAUSE EXTRACTION CONTRACT (STRICT JSON)
────────────────────────────────
Create src/core/services/policy/aiClauseExtractor.ts

Function:
extractClauses({
contractText,
rules: Array<{ ruleId, clauseType, ruleType, expectedValue }>
}) => Promise<Array<{
ruleId: string
clauseType: ClauseType
present: boolean
foundText: string | null
foundValue: string | number | object | null
confidence: number // 0..1
notes: string | null
}>>

Rules:

- NEVER judge compliance.
- NEVER invent clause text. If not present, present=false and foundText=null.
- foundText MUST be a short excerpt copied from contract (max ~700 chars).
- If present=true but cannot parse value, foundValue=null and confidence <= 0.6 with notes.
- Output must be valid JSON only (no markdown, no commentary).

Chunking / size:

- Contract text can be long. Implement safe truncation and/or chunking:
  - Prefer: extract on the first X characters + a sliding window strategy OR chunk by paragraphs.
  - Keep it simple now: cap text length (e.g. 40k chars) and warn in notes if truncated.

──────────────────────────────── 3) GEMINI INTEGRATION
────────────────────────────────
Add src/core/services/ai/geminiClient.ts:

- reads GEMINI_API_KEY from env
- calls Gemini 3.5 model
- supports:
  - system prompt
  - user prompt
  - JSON response parsing with fallback repair:
    - if invalid JSON, retry once with "Return ONLY valid JSON".

Do NOT call Gemini from tests (mock it).

Env:

- GEMINI_API_KEY in .env.local and Vercel env

──────────────────────────────── 4) PROMPT DESIGN (GUARDRAILS)
────────────────────────────────
System prompt MUST enforce:

- Output strictly JSON.
- Do not infer missing clauses.
- Use exact excerpts.
- Confidence rules.

User prompt format:

- Provide:
  - list of clauseTypes to search
  - for each: what to extract (value schema)
  - contract text (possibly truncated)
- Ask for an array of results keyed by ruleId.

Value parsing guidelines by clauseType (MVP):

- LIABILITY:
  - foundValue: { capAmount?: number, capUnit?: "EUR"|"USD"|..., capMultipleMonths?: number, unlimited?: boolean }
- TERMINATION:
  - foundValue: { noticeDays?: number, noticeBusinessDays?: number, terminationForConvenience?: boolean }
- GOVERNING_LAW:
  - foundValue: { lawCountry?: string, venue?: string }
- PAYMENT_TERMS:
  - foundValue: { paymentDays?: number, trigger?: string } // e.g. invoice receipt
- CONFIDENTIALITY:
  - foundValue: { durationMonths?: number, durationYears?: number, indefinite?: boolean }
- DATA_PRIVACY:
  - foundValue: { mentionsGDPR?: boolean, dpaMentioned?: boolean, breachNoticeHours?: number }
- INTELLECTUAL_PROPERTY:
  - foundValue: { ownership?: "client"|"vendor"|"joint"|"license", assignment?: boolean }

If parsing is uncertain, return foundValue=null, confidence <=0.6.

──────────────────────────────── 5) ORCHESTRATION UPDATE
────────────────────────────────
Update analyzeContractVersion(contractVersionId, policyId):

Before:

- STEP 5A created findings with missing clauses.

Now:

1. Load ContractVersionText (must be TEXT_READY)
2. Load Policy + PolicyRules
3. Call aiClauseExtractor.extractClauses(contractText, rules)
4. For each PolicyRule:
   - Map extractor result by ruleId
   - Determine "clause exists" from present/confidence
   - Set ClauseFinding.foundText/foundValue/confidence
   - Deterministic evaluation:
     - REQUIRED:
       - if present=false OR confidence < 0.5 => VIOLATION (missing/uncertain)
       - else => COMPLIANT (for Step 5B)
     - FORBIDDEN:
       - if present=true and confidence >=0.6 => VIOLATION
       - else => COMPLIANT/NOT_APPLICABLE
     - MIN_VALUE / MAX_VALUE / ALLOWED_VALUES:
       - if present=false => VIOLATION (missing)
       - if present=true but foundValue null or low confidence => UNCLEAR
       - else compare against expectedValue deterministically -> COMPLIANT or VIOLATION
5. Compute score same as before.
6. Persist findings + compliance.

Idempotency:

- Re-running analyze overwrites previous findings for same (versionId, policyId) to keep clean.

──────────────────────────────── 6) API & UI
────────────────────────────────
No new routes required if /analyze already exists.
But update /compliance payload and UI to show:

- Found vs Expected
- Confidence
- Show foundText excerpt in expandable section
- For numeric rules show the extracted numeric value in UI

UI display rule:

- If complianceStatus=UNCLEAR, show reason (low confidence / cannot parse).

──────────────────────────────── 7) TESTS
────────────────────────────────

- Mock aiClauseExtractor.extractClauses to return deterministic objects.
- Tests for:
  - REQUIRED present=true => COMPLIANT
  - REQUIRED present=false => VIOLATION
  - MIN_VALUE with foundValue less than expected => VIOLATION
  - MIN_VALUE with foundValue null => UNCLEAR
  - ALLOWED_VALUES mismatch => VIOLATION
  - Confidence threshold behavior
- No real Gemini calls in tests.

Deliverables:

- gemini client wrapper + env
- aiClauseExtractor with strict JSON output
- policy engine updated to consume AI extraction
- UI shows found vs expected + confidence + excerpt
- tests updated
- manual verification checklist (upload doc, extract text, analyze with policy, see found/expected)
