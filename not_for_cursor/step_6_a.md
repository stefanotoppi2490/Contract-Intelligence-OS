Make /ledger human-readable by adding a deterministic “Summary” string per LedgerEvent.

Current:
Ledger prints raw fields:
time, type, entityType/entityId, metadata JSON.

Goal:
Show a “Summary” column that is meaningful to humans, e.g.:

- “Exception withdrawn for DATA_PRIVACY”
- “Exception approved: Accept 5-day termination notice”
- “Analysis run: Default Company Standard — score 60 → 75”
- “Policy rule updated: LIABILITY REQUIRED (weight 25)”
- “Contract uploaded: Consulting Agreement.pdf”

Constraints:

- Deterministic, NO AI.
- No DB migration required for MVP.
- Keep workspace scoping + RBAC exactly as-is.

Implementation plan:

1. Create formatter:
   src/core/services/ledger/ledgerSummary.ts
   export function formatLedgerSummary(event, ctx?) => string
   - event includes: type, entityType, entityId, contractId, policyId, exceptionId, metadata

2. Add optional lookups (only when needed):
   - If event.contractId: fetch Contract.title
   - If event.policyId: fetch Policy.name
   - If event.exceptionId: fetch ExceptionRequest.title (and clauseType)
   - If actorUserId present: use session.user name/email OR lookup user by id (if we have User table)
     These lookups must be batched to avoid N+1:
   - In /ledger page server loader or API route, collect unique ids and query them once.
   - Provide maps: contractTitleById, policyNameById, exceptionTitleById, actorNameById.

3. Summaries by type (MVP):
   - CONTRACT_UPLOADED:
     “Contract uploaded: {contractTitle ?? entityId} ({metadata.originalName ?? 'file'})”
   - TEXT_EXTRACTED:
     “Text extracted ({metadata.extractor ?? 'unknown'}) — {metadata.status ?? ''}”
   - ANALYSIS_RUN:
     “Analysis run: {policyName ?? policyId} — score {metadata.rawScore ?? '?'} → {metadata.effectiveScore ?? metadata.rawScore ?? '?'}”
   - EXCEPTION_REQUESTED:
     “Exception requested: {exceptionTitle ?? '—'} ({metadata.clauseType ?? '—'})”
   - EXCEPTION_APPROVED:
     “Exception approved: {exceptionTitle ?? '—'} ({metadata.clauseType ?? '—'})”
   - EXCEPTION_REJECTED:
     “Exception rejected: {exceptionTitle ?? '—'} ({metadata.clauseType ?? '—'})”
   - EXCEPTION_WITHDRAWN:
     “Exception withdrawn: {exceptionTitle ?? '—'} ({metadata.clauseType ?? '—'})”
   - POLICY_CREATED:
     “Policy created: {policyName ?? entityId}”
   - POLICY_RULE_CREATED:
     “Policy rule created: {metadata.clauseType ?? ''} {metadata.ruleType ?? ''} (weight {metadata.weight ?? '?'})”
   - POLICY_RULE_UPDATED:
     “Policy rule updated: {metadata.clauseType ?? ''} {metadata.ruleType ?? ''}”
   - POLICY_RULE_DELETED:
     “Policy rule deleted: {metadata.clauseType ?? ''} {metadata.ruleType ?? ''}”

   Fallback:
   “{type} — {entityType} {entityId}”

4. Wire it into /ledger UI:
   - Add a “Summary” column, show the formatted summary.
   - Keep existing columns (time, type, entity, etc.) for audit completeness.
   - Show metadata JSON in a collapsible “Details” view.

5. Improve event metadata going forward:
   Ensure ledgerService.recordEvent includes useful metadata:
   - For analysis: { policyId, rawScore, effectiveScore }
   - For exceptions: { clauseType, exceptionTitle }
   - For upload: { originalName, mimeType, size }
     But do not backfill old events; just handle missing fields gracefully.

6. Tests:
   - formatLedgerSummary returns expected strings for 3-4 representative events.
   - ledger list endpoint includes summary field.

Deliverables:

- ledgerSummary formatter
- updated ledger list (page or API) with batched lookups and summary field
- UI column + optional details expander
- tests for formatter
