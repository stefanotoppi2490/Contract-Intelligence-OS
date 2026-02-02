Implement STEP 6: Exceptions + Ledger (audit trail) end-to-end.

Context:

- STEP 5B complete: analysis produces ClauseFindings with foundText/foundValue/confidence and deterministic compliance + score.
- Policies are editable in /policies.
- Workspace-scoped app, RBAC in place (VIEWER read-only; LEGAL/RISK/ADMIN can analyze/manage).

Goal:
When a contract version has violations or unclear findings, users can:

1. Request an exception for a specific finding (or custom request).
2. Approvers can approve/reject.
3. All actions are recorded in a Ledger (audit log).
4. Compliance can reflect approved exceptions (override).

────────────────────────────────

1. PRISMA MODELS
   ────────────────────────────────

Add enums:
ExceptionStatus: REQUESTED | APPROVED | REJECTED | WITHDRAWN
ExceptionDecision: APPROVE | REJECT
LedgerEventType:

- CONTRACT_UPLOADED
- TEXT_EXTRACTED
- ANALYSIS_RUN
- EXCEPTION_REQUESTED
- EXCEPTION_APPROVED
- EXCEPTION_REJECTED
- EXCEPTION_WITHDRAWN
- POLICY_CREATED
- POLICY_RULE_CREATED
- POLICY_RULE_UPDATED
- POLICY_RULE_DELETED

Add models:

ExceptionRequest:

- id
- workspaceId
- contractId
- contractVersionId
- clauseFindingId (nullable) // usually linked to a specific finding
- policyId (nullable) // which policy it relates to
- title (string) // e.g. "Accept 5-day termination notice"
- justification (string) // user explanation
- requestedByUserId
- status ExceptionStatus
- decidedByUserId (nullable)
- decidedAt (nullable)
- decisionReason (nullable)
- createdAt
- updatedAt

ExceptionComment (optional but nice):

- id
- exceptionId
- userId
- message
- createdAt

LedgerEvent:

- id
- workspaceId
- actorUserId (nullable for system)
- type LedgerEventType
- entityType string // "contract"|"policy"|"exception"|...
- entityId string
- contractId (nullable)
- contractVersionId (nullable)
- policyId (nullable)
- exceptionId (nullable)
- metadata Json (nullable) // store deltas, rule ids, summary, etc.
- createdAt

Relationships:

- contract -> exceptions
- contractVersion -> exceptions
- clauseFinding -> exceptions (optional)
- exception -> comments
- ledger -> workspace and actor

Migrations allowed.

──────────────────────────────── 2) LEDGER SERVICE (centralized)
────────────────────────────────

Create src/core/services/ledger/ledgerService.ts:

- recordEvent({ workspaceId, actorUserId, type, entityType, entityId, contractId?, contractVersionId?, policyId?, exceptionId?, metadata? })

Replace existing "AuditEvent" writes (if any) or integrate them:

- On upload: CONTRACT_UPLOADED
- On extract: TEXT_EXTRACTED
- On analyze: ANALYSIS_RUN
- On policy CRUD: POLICY_CREATED, POLICY_RULE_CREATED/UPDATED/DELETED
- On exceptions: EXCEPTION_REQUESTED/APPROVED/REJECTED/WITHDRAWN

Make it idempotent-friendly: ok to log duplicates but avoid spamming; store metadata.

──────────────────────────────── 3) EXCEPTIONS API
────────────────────────────────

Routes (App Router):

- GET /api/exceptions
  - workspace-scoped
  - filters: status, contractId, policyId
  - RBAC: VIEWER can read

- POST /api/contracts/:id/versions/:versionId/exceptions
  Create an exception request:
  Body:
  - clauseFindingId? (optional)
  - policyId? (optional)
  - title
  - justification
    RBAC: LEGAL/RISK/ADMIN (and maybe MEMBER) can request; VIEWER cannot.

- POST /api/exceptions/:exceptionId/decide
  Body: { decision: "APPROVE"|"REJECT", decisionReason? }
  RBAC: ADMIN/RISK/LEGAL only
  Update status and write decided fields.
  Ledger event.

- POST /api/exceptions/:exceptionId/withdraw
  RBAC: requester or ADMIN
  Status -> WITHDRAWN
  Ledger event.

- POST /api/exceptions/:exceptionId/comments (optional)
  Add comment
  RBAC: any non-viewer in workspace

All routes must:

- require session + workspace
- validate ownership/workspace scoping
- return clear 403/404/409

──────────────────────────────── 4) COMPLIANCE OVERRIDE LOGIC
────────────────────────────────

Update compliance view so that approved exceptions affect findings:

Behavior:

- If a ClauseFinding is VIOLATION or UNCLEAR AND there is an APPROVED exception linked to it:
  - Display as OVERRIDDEN (or COMPLIANT_WITH_EXCEPTION)
  - Do NOT deduct its weight from score, OR deduct partially (configurable). For MVP: remove deduction.
  - Show a badge "Approved exception" + link to exception detail.

Implement deterministic recalculation:

- When fetching compliance, compute "effective score" considering approved exceptions.
- Store original score and effective score, or compute effective on the fly (preferred now).

Add a new complianceStatus enum value for UI only if needed:

- OVERRIDDEN

──────────────────────────────── 5) UI PAGES
────────────────────────────────

A) /exceptions

- List all exception requests in workspace:
  - status, title, contract, version, clauseType (if linked), requestedBy, createdAt
  - filters by status
- Clicking opens detail page: /exceptions/[id]
- RBAC: VIEWER can view, cannot decide.

B) /exceptions/[id]

- Show:
  - title, status
  - linked contract/version + link
  - linked finding details (found/excerpt, expected, severity, risk, recommendation)
  - justification
  - decision (if any)
  - buttons:
    - Approve / Reject (ADMIN/LEGAL/RISK)
    - Withdraw (requester/admin)
  - (optional) comments thread

C) Contract Detail (/contracts/[id])

- For each finding that is VIOLATION/UNCLEAR:
  - Add button "Request exception"
  - Opens a small modal/form: title + justification
  - Creates exception linked to that finding
- If an exception exists:
  - show its status badge and link to exception

D) /ledger

- Table of LedgerEvent:
  - time, actor, type, entity, contract/policy/exception references
  - filters: type, contractId
- Basic pagination (even 50 latest ok for MVP)

Keep styling consistent with existing UI.

──────────────────────────────── 6) TESTS
────────────────────────────────

- Creating exception requires RBAC (VIEWER 403)
- Creating exception is workspace-scoped (cross-workspace 404/403)
- Approve/reject updates status and writes ledger event
- Approved exception changes effective score (weight removed)
- Ledger endpoint returns events

Mock time if needed.

──────────────────────────────── 7) MANUAL VERIFICATION CHECKLIST
────────────────────────────────

1. Upload + extract + analyze a contract with violations.
2. From contract detail, click "Request exception" on a VIOLATION.
3. Go to /exceptions, see the request.
4. Approve it as ADMIN/RISK/LEGAL.
5. Go back to contract detail:
   - Finding shows "Approved exception"
   - Effective score increases accordingly
6. Check /ledger shows:
   - ANALYSIS_RUN
   - EXCEPTION_REQUESTED
   - EXCEPTION_APPROVED
7. VIEWER can view /exceptions and /ledger but cannot take actions.
