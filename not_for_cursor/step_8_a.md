Implement STEP 8A: AI-assisted Clause Extraction (neutral, evidence-based).

Context:

- STEP 7 complete.
- We already use AI to extract findings directly.
- We now want to decouple AI extraction from policy evaluation.
- Policy Engine and scoring must NOT change behavior yet.
- Workspace-scoped app, RBAC enforced.
- Deterministic logic remains the source of truth.

Goal:
Introduce a neutral AI extraction layer that:

- extracts structured clause data
- includes evidence + confidence
- does NOT compute compliance, violations, or score

────────────────────────────────

1. PRISMA MODEL
   ────────────────────────────────

Add model ClauseExtraction:

- id
- workspaceId
- contractId
- contractVersionId
- clauseType (enum ClauseTaxonomy)
- extractedValue Json (nullable)
- extractedText Text (excerpt / quote)
- confidence Float (0–1)
- sourceLocation Json (optional: page, paragraph, offsets)
- extractedBy "AI"
- createdAt

Indexes:

- contractVersionId
- clauseType

Relations:

- contractVersion -> clauseExtractions
- workspace FK

DO NOT remove or change ClauseFinding or ContractCompliance.

──────────────────────────────── 2) EXTRACTION SERVICE (AI)
────────────────────────────────

Create:
src/core/services/extraction/aiClauseExtractor.ts

Input:

- contractVersionId
- extracted full text

Output:
Array<{
clauseType
extractedValue
extractedText
confidence
sourceLocation?
}>

Rules:

- One extraction per clauseType max (MVP).
- If clause not found → skip (do not invent).
- extractedValue must be structured when possible (e.g. noticeDays, liabilityCap).
- extractedText must be a direct quote.
- confidence must be realistic (0.0–1.0).

NO compliance logic here.

──────────────────────────────── 3) PIPELINE INTEGRATION
────────────────────────────────

Where text extraction currently finishes (TEXT_READY):

- Call aiClauseExtractor
- Persist ClauseExtraction records

Important:

- If AI extraction fails, log error but DO NOT block workflow.
- Analysis / policy engine must continue to work as before.

──────────────────────────────── 4) API
────────────────────────────────

GET /api/contracts/:id/versions/:versionId/extractions

- Returns ClauseExtraction[]
- RBAC: VIEWER can read

──────────────────────────────── 5) UI (READ-ONLY)
────────────────────────────────

In /contracts/[id] detail:

- For each version, add a collapsible section:
  "AI-extracted clauses (preview)"

Show:

- clauseType
- extractedValue (pretty JSON)
- extractedText (blockquote)
- confidence badge

NO editing yet.

──────────────────────────────── 6) TESTS
────────────────────────────────

- ClauseExtraction is created after TEXT_READY
- Missing clauses are skipped
- Confidence is between 0 and 1
- Existing analysis still works unchanged

──────────────────────────────── 7) SAFETY CHECK
────────────────────────────────

- No policy logic modified
- No score calculation changed
- No ClauseFinding removed or rewritten

Deliverables:

- Prisma migration
- aiClauseExtractor service
- Integration hook after text extraction
- Read-only UI
- Tests
