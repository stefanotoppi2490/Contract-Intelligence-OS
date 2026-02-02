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
4. Compliance can reflect approved exceptions (override) and show effective score.

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
- policyId (nullable)
- clauseType (optional denormalized, helpful in lists)
- title
- justification
- requestedByUserId
- status ExceptionStatus
- decidedByUserId (nullable)
- decidedAt (nullable)
- decisionReason (nullable)
- createdAt
- updatedAt

Uniqueness / dedupe:

- Prevent duplicate “active” exceptions for same target:
  - If clauseFindingId is present: enforce at service-level: only one exception with status in (REQUESTED, APPROVED) per clauseFindingId.
  - If clauseFindingId missing: enforce one exception per (contractVersionId, policyId, title) in REQUESTED state.

ExceptionComment (optional):

- id, exceptionId, userId, message, createdAt

LedgerEvent:

- id
- workspaceId
- actorUserId (nullable)
- type LedgerEventType
- entityType string
- entityId string
- contractId (nullable)
- contractVersionId (nullable)
- policyId (nullable)
- exceptionId (nullable)
- metadata Json (nullable) // include policyId, score, clauseType, etc.
- createdAt

Relationships:

- contract -> exceptions
- contractVersion -> exceptions
- clauseFinding -> exceptions (optional)
- exception -> comments
- ledger -> workspace and actor

──────────────────────────────── 2) LEDGER SERVICE (centralized)
────────────────────────────────
Create src/core/services/ledger/ledgerService.ts:

- recordEvent({ workspaceId, actorUserId, type, entityType, entityId, contractId?, contractVersionId?, policyId?, exceptionId?, metadata? })

Integrate events:

- upload: CONTRACT_UPLOADED (metadata: { fileName, mimeType, size })
- extract: TEXT_EXTRACTED (metadata: { extractor, status })
- analyze: ANALYSIS_RUN (metadata: { policyId, rawScore, effectiveScore? })
- policy CRUD: POLICY_CREATED / POLICY_RULE_CREATED/UPDATED/DELETED
- exceptions: EXCEPTION_REQUESTED/APPROVED/REJECTED/WITHDRAWN (metadata includes clauseType)

Ok if duplicates exist, but metadata should make events useful.

──────────────────────────────── 3) EXCEPTIONS API
────────────────────────────────
Routes:

- GET /api/exceptions
  - workspace scoped
  - filters: status, contractId, policyId
  - RBAC: VIEWER can read
  - returns list with contract title, clauseType, requestedBy, status, timestamps

- POST /api/contracts/:id/versions/:versionId/exceptions
  - Body: { clauseFindingId?, policyId?, title, justification }
  - RBAC: LEGAL/RISK/ADMIN only (VIEWER 403)
  - If clauseFindingId provided:
    - verify finding belongs to version and workspace
    - dedupe: if an active exception already exists for that finding -> return 409 with existing exception id
  - Ledger: EXCEPTION_REQUESTED

- POST /api/exceptions/:exceptionId/decide
  - Body: { decision: "APPROVE"|"REJECT", decisionReason? }
  - RBAC: ADMIN/RISK/LEGAL only
  - Updates status + decidedBy/decidedAt fields
  - Ledger: EXCEPTION_APPROVED or EXCEPTION_REJECTED

- POST /api/exceptions/:exceptionId/withdraw
  - RBAC: requester or ADMIN
  - status -> WITHDRAWN
  - Ledger: EXCEPTION_WITHDRAWN

- POST /api/exceptions/:exceptionId/comments (optional)
  - RBAC: any non-viewer in workspace

All routes:

- require session + workspace
- validate scoping
- clear 403/404/409

──────────────────────────────── 4) COMPLIANCE OVERRIDE LOGIC
────────────────────────────────
Update compliance computation to include exceptions:

If a finding is VIOLATION or UNCLEAR and there is an APPROVED exception linked to it:

- mark finding as OVERRIDDEN (UI-only)
- do not deduct its weight from effectiveScore (MVP)
- show badge + link to exception

Return from compliance endpoint:

- rawScore
- effectiveScore
- findings[] including: isOverridden, exceptionId, exceptionStatus

Compute effectiveScore in service layer (deterministic).

──────────────────────────────── 5) UI PAGES
────────────────────────────────
A) /exceptions

- List exception requests with filters by status.

B) /exceptions/[id]

- Detail page:
  - title, status, contract/version links
  - linked finding (found/excerpt, expected, severity/risk/recommendation)
  - justification
  - decision section
  - buttons: Approve/Reject (ADMIN/LEGAL/RISK), Withdraw (requester/admin)
  - optional comments

C) /contracts/[id]

- For each finding with VIOLATION/UNCLEAR:
  - if role allows: show "Request exception" button
  - modal: title + justification
  - if exception already exists: show badge + link; hide request or show disabled state

D) /ledger

- Table of LedgerEvent
- filters: type, contractId
- basic pagination (latest 50 ok)

──────────────────────────────── 6) TESTS
────────────────────────────────

- VIEWER cannot create/decide/withdraw (403)
- Creating exception is workspace scoped
- Dedupe: second request for same finding returns 409
- Approve/reject writes ledger event
- Approved exception increases effectiveScore (weight removed)
- Ledger endpoint returns events

──────────────────────────────── 7) MANUAL CHECKLIST
────────────────────────────────

1. Upload + extract + analyze a contract with violations.
2. Request exception on a VIOLATION from contract detail.
3. See it in /exceptions.
4. Approve it as ADMIN/RISK/LEGAL.
5. Back to contract detail:
   - finding shows Approved exception badge + link
   - effectiveScore increases
6. /ledger shows ANALYSIS_RUN + EXCEPTION_REQUESTED + EXCEPTION_APPROVED
7. VIEWER can read /exceptions and /ledger but cannot act.
