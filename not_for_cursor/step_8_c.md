Prompt per Cursor — STEP 8C

Implement STEP 8C: Use AI confidence to mark findings as UNCLEAR + “more human” compliance summary (deterministic).

Context
• STEP 8B complete: Policy Engine consumes ClauseExtraction and produces ClauseFinding deterministically.
• ClauseExtraction has confidence (0–1), extractedValue (JSON), extractedText (excerpt).
• ClauseFinding has complianceStatus (COMPLIANT|VIOLATION|UNCLEAR|NOT_APPLICABLE) and stores confidence, foundValue, foundText.
• Scoring currently deducts weight only for VIOLATION (and excludes OVERRIDDEN via approved exceptions).

Goal

Use ClauseExtraction.confidence to: 1. Set ClauseFinding.complianceStatus = UNCLEAR when confidence is below a threshold (deterministically). 2. Keep score deterministic and audit-friendly:
• UNCLEAR does NOT deduct weight (MVP).
• Compliance summary should surface “needs review” count and label. 3. Make it visible in UI and comparable in STEP 7 compare. 4. Add tests.

⸻

1. Config (workspace-level later, MVP hardcoded)

Create:
src/core/config/confidence.ts

export const CONFIDENCE_THRESHOLDS = {
DEFAULT: 0.75,
// optional: per clause type overrides later
} as const;

Also expose in env if you want (optional):
CONFIDENCE_THRESHOLD=0.75 with fallback to 0.75.

Keep it simple now: use 0.75.

⸻

2. Policy Engine update (deterministic)

File: src/core/services/policy/policyEngine.ts (or where the evaluation happens)

Current behavior (8B)
• If extraction missing:
• REQUIRED => VIOLATION
• else => NOT_APPLICABLE
• If found:
• evaluate ruleType and set COMPLIANT/VIOLATION/UNCLEAR based on rule evaluation (if exists)

New behavior (8C)

When extraction exists but confidence < threshold:
• Set finding as UNCLEAR
• Set foundValue, foundText, confidence as usual
• Add deterministic reason field (see model change below) or set recommendation to indicate low confidence
• Do not run rule evaluation in this case (because the input is unreliable)
• “Se LOW_CONFIDENCE → complianceStatus = UNCLEAR anche se l’evaluazione avrebbe dato COMPLIANT/VIOLATION.”

When confidence >= threshold:
• Run rule evaluation as before

Important edge cases
• Confidence must be clamped 0..1.
• If extraction has confidence null/undefined, treat as 0.0 and mark UNCLEAR.
• If ruleType is REQUIRED and extraction exists but low confidence -> UNCLEAR (not VIOLATION).

⸻

3. Schema change (minimal, optional but recommended for audit UX)

Add to ClauseFinding:
• unclearReason (string nullable)

Example values:
• "LOW_CONFIDENCE"
• "MISSING_EXTRACTION"
• "AMBIGUOUS_VALUE"

MVP: only "LOW_CONFIDENCE".

Migration:
• Add column unclearReason TEXT nullable
No enum needed.

If you prefer no schema change: embed this in foundText or recommendation, but better to keep explicit.

⸻

4. Compliance “more human” summary

Where compliance is computed (service/repo; likely contractComplianceService or within analyze route):
• “Non cambiare la formula di rawScore/effectiveScore esistente: modifica solo la classificazione VIOLATION→UNCLEAR in base alla confidence e lascia invariata la sottrazione dei pesi (solo VIOLATION non overridden).”
• Keep rawScore and effectiveScore logic unchanged:
• deduct only for VIOLATION not overridden
• UNCLEAR does not deduct
• Add these fields to response (do NOT necessarily store in DB):
• unclearCount
• violationCount
• compliantCount
• needsReview: boolean (unclearCount > 0)
• Update displayed status logic:
• If effectiveScore < 60 => NON_COMPLIANT
• Else if violationCount > 0 => NEEDS_REVIEW (or NON_COMPLIANT based on your existing thresholds)
• Else if unclearCount > 0 => NEEDS_REVIEW
• Else => COMPLIANT
Keep consistent with current rules but ensure UNCLEAR triggers NEEDS_REVIEW even if score is high.

⸻

5. API updates

Update GET compliance endpoint payload to include:
• unclearCount, violationCount, compliantCount
• include unclearReason on findings

No new routes.

⸻

6. UI updates

Contract detail findings cards

In /contracts/[id] version findings UI:
• For findings with complianceStatus === "UNCLEAR":
• Show badge “UNCLEAR” (yellow)
• Show small text: Low extraction confidence (62%), needs review
• Display confidence prominently
• Keep “Request exception” available for UNCLEAR too (same as VIOLATION)

Compliance header

Show:
• Score effective/raw (already)
• If unclearCount > 0: add “⚠ X clauses need review”

Compare page (STEP 7)

Ensure changes detect status transitions including UNCLEAR:
• VIOLATION → UNCLEAR should be treated as MODIFIED
• UNCLEAR → COMPLIANT should show WHY = “Confidence improved above threshold” or “Status changed: UNCLEAR → COMPLIANT”
Update deterministic “why” builder:
• If fromStatus != toStatus => “Compliance changed: …”
• If status becomes/was UNCLEAR and confidence crosses threshold => “Confidence below threshold (0.75)” / “Confidence now above threshold (0.75)”
• “confidence è salvata 0..1, in UI mostra percentuale (Math.round(confidence\*100)).”

⸻

7. Ledger / Audit (optional but recommended)

When analysis generates UNCLEAR due to low confidence:
• record a LedgerEvent (reuse existing ANALYSIS_RUN metadata or add a new event type only if you already planned enums)
MVP: attach metadata to ANALYSIS_RUN:

{
"unclear": [{ "clauseType":"DATA_PRIVACY","confidence":0.62,"threshold":0.75 }]
}

No enum changes (avoid migration pain).

⸻

8. Tests

Add/extend:

policyEngine.confidence.test.ts
• If extraction exists with confidence 0.6 and threshold 0.75 => finding status UNCLEAR, unclearReason LOW_CONFIDENCE
• UNCLEAR does not deduct score
• If confidence 0.9 => normal evaluation runs

compare.test.ts
• UNCLEAR → COMPLIANT yields changeType MODIFIED and “why” mentions status change
• Top drivers: UNCLEAR should not count as weight deduction

api compliance test
• GET compliance returns unclearCount and findings include unclearReason

⸻

9. Manual verification checklist
   1. Use a contract version where at least one clause extraction has confidence < 0.75 (e.g. OTHER 0.90 won’t show UNCLEAR, so pick lower).
   2. Run “Analyze contract”.
   3. Confirm:
      • finding shows UNCLEAR badge + confidence
      • effectiveScore unchanged vs when the finding was VIOLATION (if previously)
      • compliance status becomes NEEDS_REVIEW when there are UNCLEAR findings
   4. Run compare v1 vs v2:
      • if confidence crosses threshold, delta reflects status change
   5. Ensure VIEWER can see UNCLEAR but cannot analyze.

⸻

Deliverables
• migration (optional: add ClauseFinding.unclearReason)
• confidence config
• updated policy engine
• updated compliance response + UI
• compare “why” improvements for UNCLEAR
• tests + manual checklist

⸻

non cambiare schema di score, non introdurre ML/AI nel policy engine, solo usare la confidence come regola deterministica
