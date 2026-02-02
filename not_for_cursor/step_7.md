Implement STEP 7: Compare contract versions (redline + risk delta) + exportable report.

Context:

- Contracts have versions. Each version can have one main document, extracted text, and findings + compliance per policy.
- ClauseFinding includes foundValue (JSON), foundText (excerpt), confidence, complianceStatus, severity/riskType, weight, ruleId.
- ContractCompliance exists per (version, policy) and we can compute rawScore/effectiveScore.
- Exceptions can override findings for effectiveScore.
- Ledger exists and can record events.

Goal:
For a given contract, allow comparing Version A vs Version B:

1. Detect and highlight which clause findings changed (per clauseType).
2. Show risk delta: rawScore/effectiveScore difference, improved/worsened, and top drivers.
3. Provide an exportable PDF report summarizing changes and risk

Constraints:

- Deterministic. No AI required for diffing (we already have findings).
- Workspace-scoped + RBAC enforced.
- Must handle missing analysis gracefully (if a version has no compliance yet, offer “Analyze” or show prompt).
- Avoid heavy N+1 queries.

────────────────────────────────

1. DATA MODEL (minimal, optional but recommended)
   ────────────────────────────────

Option A (MVP, no new tables):

- Compute diffs on-the-fly from existing ClauseFinding + ContractCompliance.

Option B (recommended for caching/audit):
Add model VersionComparison:

- id
- workspaceId
- contractId
- fromVersionId
- toVersionId
- policyId
- rawDelta (int)
- effectiveDelta (int)
- summary Json (diff results)
- createdAt
- createdByUserId
  Unique constraint: @@unique([fromVersionId, toVersionId, policyId])

Keep MVP simple: implement on-the-fly first. Add table only if easy.

──────────────────────────────── 2) DIFF LOGIC (deterministic)
────────────────────────────────

Create service:
src/core/services/compare/versionCompare.ts

Input:

- contractId
- fromVersionId
- toVersionId
- policyId

Load:

- compliances for both versions and policy (include rawScore and effectiveScore)
- findings for both versions filtered by policyId (or rule.policyId join)
- include rule data: clauseType, ruleType, expectedValue, weight, severity/riskType, recommendation
- include approved exceptions per finding if you need effective computation indicators in UI

Build a comparable key:

- Prefer ruleId; fallback to clauseType if ruleId missing.
- key = ruleId (best) else `${clauseType}`

For each key, compute:

- statusFrom, statusTo (COMPLIANT/VIOLATION/UNCLEAR/NOT_APPLICABLE + OVERRIDDEN flag)
- foundValueFrom, foundValueTo
- foundTextFrom, foundTextTo (excerpt)
- confidenceFrom, confidenceTo
- weight, severity, riskType

Detect change types:

- ADDED: exists only in to
- REMOVED: exists only in from
- MODIFIED: both exist but any of these changed:
  - complianceStatus (or overridden)
  - normalized foundValue differs
  - significant foundText change (fallback)
- UNCHANGED: none changed

Normalization for foundValue:

- stable stringify JSON: sort keys recursively
- treat null/undefined consistently
- if foundValue missing but foundText exists, still compare foundText hash

Additionally compute “impact drivers”:

- For each finding key, compute score impact difference:
  - impactFrom = (isViolationFrom && !isOverriddenFrom) ? weight : 0
  - impactTo = (isViolationTo && !isOverriddenTo) ? weight : 0
  - deltaImpact = impactFrom - impactTo (positive means improved)
    Sort drivers by abs(deltaImpact) desc, top 5.

Outputs:
type VersionCompareResult = {
from: { versionId, versionNumber, rawScore, effectiveScore }
to: { versionId, versionNumber, rawScore, effectiveScore }
delta: { raw: number, effective: number, label: "IMPROVED"|"WORSENED"|"UNCHANGED" }
changes: Array<{
key: string
clauseType
ruleId?
severity
riskType
weight
changeType: "ADDED"|"REMOVED"|"MODIFIED"|"UNCHANGED"
from?: { status, overridden, foundValue?, foundText?, confidence? }
to?: { status, overridden, foundValue?, foundText?, confidence? }
recommendation?: string
why?: string // deterministic explanation of what changed
}>
topDrivers: Array<{
clauseType
key
deltaImpact: number
reason: string
}>
}

Deterministic “why” examples:

- “Compliance changed: VIOLATION → COMPLIANT”
- “Value changed: noticeDays 5 → 30”
- “Approved exception applied in v2”
- “Clause removed in v2”

──────────────────────────────── 3) API ROUTES
────────────────────────────────

GET /api/contracts/:id/compare?fromVersionId=...&toVersionId=...&policyId=...

- RBAC: VIEWER can read (but must be in workspace)
- Validate both versions belong to contract and workspace
- Return VersionCompareResult
- If compliance missing for a version/policy, return 409 with code "MISSING_ANALYSIS" and include which version is missing.

POST /api/contracts/:id/compare/report
Body: { fromVersionId, toVersionId, policyId }

- RBAC: LEGAL/RISK/ADMIN (VIEWER can request html/md? choose conservative: only non-viewer)
- Generates PDF server-side and returns it as a streamed download
- Content-Type: application/pdf

Ledger:

- record LedgerEventType "ANALYSIS_RUN" already exists; add a new type if desired:
  - VERSION_COMPARED
  - REPORT_EXPORTED
    If you don’t want new enum values now, store as metadata under existing event types or skip.

──────────────────────────────── 4) UI
────────────────────────────────

Add page:
A) /contracts/[id]/compare

- Select From Version (dropdown)
- Select To Version (dropdown)
- Select Policy (dropdown)
- Button “Compare”
- Shows:
  - Score cards:
    - vFrom raw/effective
    - vTo raw/effective
    - Delta badge Improved/Worsened
  - “Top drivers” list
  - Changes table:
    - ClauseType
    - ChangeType badge
    - From status/value
    - To status/value
    - Why
    - Expand row to show foundText excerpts and expectedValue/recommendation

Buttons:

- “Export report (PDF)” (or HTML/MD MVP)
- “Analyze missing version” shortcut if compare returns missing analysis (link back to contract detail + analyze)

Also add entry point:

- On /contracts/[id] detail page, add link/button: “Compare versions”

RBAC:

- VIEWER can view compare
- Only LEGAL/RISK/ADMIN can export report (and/or trigger analysis)

──────────────────────────────── 5) REPORT EXPORT (MVP first)
────────────────────────────────

MVP export format: PDF.

- Create generator:
  src/core/services/reports/versionCompareReport.ts
  function buildComparePdf(result): Uint8Array | Buffer

Report sections:

- Contract title, policy, date
- Version summary + scores
- Delta label
- Top drivers
- Changes (only ADDED/REMOVED/MODIFIED)
- Footer: “Generated by Contract Intelligence OS” + workspace

If PDF:

- Use @react-pdf/renderer for server-side PDF generation (Vercel-safe).

──────────────────────────────── 6) TESTS
────────────────────────────────

- compare service:
  - detects MODIFIED when foundValue differs (JSON)
  - detects status change VIOLATION → COMPLIANT
  - topDrivers sorting works
  - effective delta accounts for overridden findings (approved exceptions)
- API:
  - cross-workspace access forbidden
  - missing analysis returns 409 MISSING_ANALYSIS
- report generator:
  - returns non-empty markdown/html and includes delta label

──────────────────────────────── 7) MANUAL VERIFICATION CHECKLIST
────────────────────────────────

1. Create contract with 2 versions.
2. Upload docs, extract text.
3. Analyze both versions with same policy.
4. Ensure at least one clause changes between v1 and v2 (e.g. termination notice 5 → 30 days).
5. Go to /contracts/[id]/compare:
   - select v1, v2, policy
   - compare shows delta improved and lists termination as MODIFIED with why
6. Add an approved exception in v1 for a violation, then analyze v2 without it:
   - effective score delta reflects override logic
7. Export report and verify file content.
