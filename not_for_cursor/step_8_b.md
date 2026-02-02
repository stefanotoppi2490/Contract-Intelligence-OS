Implement STEP 8B: Policy Engine consumes ClauseExtraction and generates ClauseFindings deterministically (NO behavior change yet).

Context:
• STEP 8A complete: ClauseExtraction table exists and is populated after text extraction (TEXT_READY). It contains: clauseType, extractedValue (json), extractedText (quote), confidence (0–1), sourceLocation.
• Current analysis already exists: /api/contracts/:id/versions/:versionId/analyze creates ClauseFindings + ContractCompliance for a selected Policy.
• Requirement from STEP 8A: policy engine + scoring must NOT change behavior yet (we only change input source). Deterministic logic remains the source of truth.
• Workspace scoping + RBAC already enforced.

Goal:
Change the deterministic policy evaluation pipeline from:
(raw text or AI guesses) -> ClauseFinding -> Compliance
to:
ClauseExtraction (neutral evidence) -> Policy Engine -> ClauseFinding (evaluation result) -> Compliance

ClauseFinding must become “evaluation result of a PolicyRule”, not “AI output”. 1. Data flow change (core)
Update policyEngine (or analyze service) so that when analyzing a version + policy:

    •	For each PolicyRule in the selected policy:
    •	Look up ClauseExtraction for the same contractVersionId + clauseType.
    •	If not found:
    •	If ruleType is REQUIRED -> ClauseFinding = VIOLATION (as before)
    •	Else -> ClauseFinding = NOT_APPLICABLE
    •	If found:
    •	ClauseFinding.foundValue = extraction.extractedValue
    •	ClauseFinding.foundText = extraction.extractedText
    •	ClauseFinding.confidence = extraction.confidence (store as 0–1 OR convert to 0–100 but be consistent everywhere)
    •	Evaluate ruleType deterministically based on extractedValue:
    •	REQUIRED: if extraction exists -> COMPLIANT (keep behavior unchanged for now)
    •	FORBIDDEN: if extraction exists -> VIOLATION (keep behavior unchanged for now)
    •	MIN_VALUE/MAX_VALUE/ALLOWED_VALUES: if extractedValue is missing/invalid -> UNCLEAR; else evaluate properly
    •	Always attach rule metadata to ClauseFinding (weight, severity, riskType, recommendation) as you already do.

Important: NO AI calls during analyze. Analyze must be fully deterministic given ClauseExtractions + policy. 2. Backward compatibility
We must not break existing contracts that might not have ClauseExtractions yet.
Implement a safe fallback strategy:

    •	If ClauseExtraction records do NOT exist for that version:
    •	Return 409 with code “MISSING_EXTRACTIONS” and message “Run AI clause extraction first” (preferred)
    •	Or, if you already have old behavior, keep it behind a feature flag.

Add env flag:
• USE_CLAUSE_EXTRACTIONS=true (default true in dev)
Behavior:
• If true: analysis requires extractions; otherwise 409 MISSING_EXTRACTIONS.
• If false: keep old analysis path (temporary).

    3.	API / UX behavior

In /contracts/[id] UI:

    •	If user tries “Analyze contract” but extractions are missing:
    •	Show a clear message: “Run AI clause extraction first”
    •	Provide a visible button to trigger extraction (if you already have it as automatic on TEXT_READY, allow manual re-run too).

Add a route if missing:
POST /api/contracts/:id/versions/:versionId/extractions/run
• RBAC: LEGAL/RISK/ADMIN only
• Loads ContractVersionText (must be TEXT_READY)
• Runs aiClauseExtractor
• Upserts ClauseExtraction per clauseType
• Records ledger metadata (model, count, avgConfidence)
This route should exist even if auto-extraction after TEXT_READY already happens, so operator can re-run.

    4.	UI linking evidence

Update Findings UI (contract detail):

    •	When a ClauseFinding is rendered, show:
    •	Evidence excerpt (foundText)
    •	Confidence badge (converted consistently, e.g. 0.92 -> 92%)
    •	If sourceLocation exists, show “page X” if available.

Also update Exceptions detail:
• If exception is linked to a ClauseFinding, show the evidence excerpt and confidence prominently.

    5.	Tests

Add/adjust tests to confirm:

    •	Given ClauseExtractions + policy rules, analyze produces ClauseFindings deterministically (same inputs => same outputs).
    •	No AI service is called during analyze (mock aiClauseExtractor and assert not invoked).
    •	If USE_CLAUSE_EXTRACTIONS=true and version has no extractions -> analyze returns 409 MISSING_EXTRACTIONS.
    •	Rule evaluation uses extractedValue when present (e.g. MIN_VALUE evaluation works if extractedValue has noticeDays).
    •	Workspace scoping still enforced.

    6.	Ledger

On successful extraction run (auto or manual):

    •	Record a ledger event (reuse existing type if you don’t want new enum) with metadata:

{ versionId, extractedCount, avgConfidence, model }
On analysis run:
• Add metadata field:
{ mode: “EVALUATE_EXTRACTED_CLAUSES”, policyId }

Constraints:
• Do NOT change scoring rules yet (no confidence-weighted scoring in this step).
• Do NOT let AI decide compliance; AI only provides evidence.
• Keep all behavior deterministic and repeatable.

End of prompt.
