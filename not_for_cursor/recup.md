Implement STEP 1: Prisma DB Core v1 for Contract Intelligence OS.

Constraints:

- Next.js App Router + TypeScript strict.
- ORM Prisma + PostgreSQL.
- Create a complete Prisma schema (schema.prisma) with these models:
  Workspace, User, Membership,
  Counterparty, Contract, ContractVersion, Document,
  ClauseFinding, Policy, PolicyViolation,
  ExceptionRequest,
  RiskLedgerEvent (append-only), AuditEvent (append-only).
- Add all enums: MemberRole, ContractType, ClauseType, RuleType, Severity, RiskType, PartyBias,
  ComplianceStatus, RecommendedAction, ExceptionStatus.
- Relationships:
  - Workspace 1..\* Membership, Counterparty, Contract, Policy, RiskLedgerEvent, AuditEvent.
  - User 1..\* Membership.
  - Counterparty 1..\* Contract.
  - Contract 1..\* ContractVersion.
  - ContractVersion 1.._ Document (or 1.._ documents linked), ClauseFinding, PolicyViolation, ExceptionRequest.
- Add unique constraints and indexes suitable for enterprise:
  - Membership unique (workspaceId, userId)
  - Policy unique (workspaceId, policyId) and index (workspaceId, clauseType)
  - ContractVersion unique (contractId, versionNumber)
  - PolicyViolation unique (contractVersionId, policyId)
  - ClauseFinding unique (contractVersionId, clauseType)
  - ExceptionRequest prevent multiple PENDING per (contractVersionId, policyId)
  - Index all tables by workspaceId and createdAt.
- Append-only logs:
  RiskLedgerEvent and AuditEvent must be immutable by design; no update flows. Include eventType, actorUserId, payload Json.
- Use Prisma Json where needed (policy expected values, extracted values).
- After schema:
  1. create prisma client wrapper at src/core/db/prisma.ts (Vercel-safe singleton).
  2. create repositories in src/core/db/repositories/\* with typed methods skeletons (no TODO; implement basic CRUD methods).
  3. add Zod env schema in src/lib/env.ts for DATABASE_URL.
  4. Provide the migration commands and ensure `prisma generate` works.
     Deliverables:
- schema.prisma
- src/core/db/prisma.ts
- src/core/db/repositories/\*.ts
- src/lib/env.ts
- Minimal README snippet for local Postgres + prisma migrate dev.

Implement STEP 2: Authentication + Workspace + RBAC foundation (NextAuth) for Contract Intelligence OS.

Context:

- Prisma schema v1 is already implemented with: Workspace, User, Membership (role), AuditEvent.
- Next.js App Router + TS strict.
- Must be deployable on Vercel.

Requirements:

1. NextAuth (Auth.js) setup:
   - Use Prisma adapter (Auth.js Prisma Adapter).
   - Provider: Email magic link OR Google OAuth (choose Google OAuth by default; keep it easy).
   - Persist users into Prisma User model.
   - Ensure session includes: userId, email, currentWorkspaceId (selected workspace), and role in that workspace.
   - Add a utility to load session server-side (no client hacks).

2. Workspace onboarding & selection:
   - If user has no memberships: force onboarding page to create first Workspace.
   - Create workspace: name required, create membership role=ADMIN for creator.
   - If user has memberships: show workspace selector.
   - Store currentWorkspaceId in a signed cookie (server-side) OR user preference table (prefer cookie for MVP).
   - Every app route under /(app) requires auth + current workspace selected.

3. RBAC:
   - Implement RBAC guard helpers:
     - requireAuth()
     - requireWorkspace()
     - requireRole(minRole or allowedRoles)
   - Roles: ADMIN, LEGAL, RISK, MEMBER, VIEWER
   - Provide a deterministic role precedence order.

4. Audit:
   - When workspace is created, membership created, workspace selected: write AuditEvent.
   - AuditEvent must be append-only, with actorUserId, workspaceId, eventType, payload Json.

5. UI:
   - Create app layout shell under /app/(app)/layout.tsx with nav:
     - Contracts
     - Policies
     - Exceptions
     - Ledger
     - Settings (Members)
   - Create pages:
     - /app/(auth)/signin
     - /app/(app)/onboarding (create workspace)
     - /app/(app)/select-workspace
     - /app/(app)/settings/members (list members, only ADMIN can access)

6. Members management (MVP):
   - ADMIN can invite/add members by email:
     - If user exists: create membership
     - If not: create a pending invitation record as placeholder in payload (if Invitation model doesn't exist yet, store as AuditEvent only and show UI message "invitation sent"; do not invent new tables unless necessary).
   - ADMIN can change member role (except cannot demote last ADMIN).
   - ADMIN can remove member (except cannot remove last ADMIN).

7. API routes:
   - Use Next.js Route Handlers.
   - Implement:
     - POST /api/workspaces (create)
     - GET /api/workspaces (list mine)
     - POST /api/workspaces/select (set current workspace)
     - GET /api/members (list members in current workspace)
     - POST /api/members (add member)
     - PATCH /api/members/:id (change role)
     - DELETE /api/members/:id (remove)

8. Validation & quality:
   - Validate every request with Zod.
   - Never access Prisma directly in route handlers; use repositories.
   - Implement minimal tests:
     - unit test RBAC role precedence
     - unit test "cannot demote last admin"

Deliverables:

- NextAuth config in /app/api/auth/[...nextauth]/route.ts (or Auth.js equivalent for App Router)
- src/core/services/security/auth.ts + rbac.ts
- API routes + Zod schemas
- UI pages/components (shadcn)
- Tests (vitest or jest; pick one and wire minimal config)
- README snippet: how to set GOOGLE_CLIENT_ID/SECRET and NEXTAUTH_SECRET.

Implement STEP 3: Contracts core (CRUD + versioning + counterparty) without AI.

Context:

- STEP 2 is complete: NextAuth works, Workspace selection + RBAC + AuditEvent exist.
- Routing groups: /(auth) for /signin, /(setup) for onboarding/select-workspace, /(app) protected for app pages.
- Prisma schema v1 includes: Counterparty, Contract, ContractVersion, Document (workspace-scoped).
- Repositories exist and Prisma must not be used directly in route handlers.

Requirements:

1. Counterparty CRUD (workspace-scoped):
   - fields: name (required), type (CUSTOMER|VENDOR), notes optional.
   - enforce uniqueness (workspaceId, name) in app logic (and DB if already present).

2. Contract CRUD (workspace-scoped):
   - fields: title, contractType enum, counterpartyId, status (DRAFT|IN_REVIEW|SIGNED|ARCHIVED), startDate/endDate optional.
   - contract belongs to workspace and counterparty.

3. ContractVersion:
   - Auto-create v1 on contract creation (preferred).
   - Allow adding new versions manually.
   - versionNumber increments per contract, unique (contractId, versionNumber).

4. Document metadata (MVP, no blob storage yet):
   - Attach document metadata to a version:
     - originalName, mimeType, size, storageKey (placeholder), source (UPLOAD|INTEGRATION).
   - UI should accept file selection but only persist metadata + placeholder storageKey (e.g. "pending://<uuid>").
   - Validate allowed mime types server-side (pdf/docx/txt at minimum).

5. UI pages (shadcn/ui + server-first):
   - /contracts (list):
     - filters: status, contractType, counterparty
     - link to detail
   - /contracts/new:
     - create contract
     - select existing counterparty OR create counterparty inline
     - upon creation, v1 is created
   - /contracts/[id] (detail):
     - contract summary
     - versions list (v1, v2...)
     - create new version
     - per version: attach document metadata (upload metadata form)
   - /counterparties:
     - list/create/edit/delete

6. API routes (Route Handlers) with Zod validation:
   - Counterparties:
     - GET/POST /api/counterparties
     - PATCH/DELETE /api/counterparties/:id
   - Contracts:
     - GET/POST /api/contracts
     - GET/PATCH/DELETE /api/contracts/:id
     - POST /api/contracts/:id/versions
     - POST /api/contracts/:id/versions/:versionId/documents

7. RBAC:
   - VIEWER read-only.
   - MEMBER/LEGAL/RISK can create/update.
   - ADMIN can do all.

8. Audit:
   - Write AuditEvent for:
     - create/update/delete counterparty
     - create/update/delete contract
     - create contract version
     - attach document metadata

9. Quality:
   - No direct Prisma access in route handlers; use repositories.
   - Add repository helpers if missing:
     - contractRepo: createContractWithV1(), createNextVersion(), listContracts(filters), getContractDetail()
     - documentRepo: attachDocumentToVersion()
   - Tests (vitest or jest, whichever project already uses):
     - versionNumber increments correctly and is race-safe (use transaction or unique retry strategy)
     - workspace scoping enforced (cannot access another workspace record)
     - VIEWER cannot mutate (at least one API test or unit test on RBAC guard)

Deliverables:

- repositories updates (counterpartyRepo, contractRepo, contractVersionRepo if separate, documentRepo)
- API routes + Zod schemas
- UI pages + minimal components
- tests
- short manual verification checklist

Implement STEP 4: Real file upload (Vercel Blob) + text extraction pipeline + ingestion status.

Context:

- STEP 3 complete: contracts, versions, document metadata, 1 main document per version enforced (409 if already exists).
- Next.js App Router on Vercel.
- Prisma has Document; migrations allowed.

Requirements:

1. Storage (real upload):

- Use Vercel Blob.
- Implement POST /api/contracts/:id/versions/:versionId/upload:
  - Accept a file upload (multipart) OR use @vercel/blob/client upload then confirm server-side.
  - Enforce RBAC: VIEWER cannot upload.
  - Enforce workspace scoping (contract/version must belong to current workspace).
  - Enforce "1 main document per contractVersion": if exists -> return 409.
  - Persist Document fields:
    - originalName, mimeType, size
    - storageKey = blob URL (preferred)
    - source = UPLOAD
    - (optional but recommended) ingestionStatus enum: UPLOADED|TEXT_READY|ERROR and lastError.

2. Text model (separate table preferred):

- Add ContractVersionText table linked to ContractVersion with:
  - contractVersionId (unique)
  - text (long)
  - extractedAt
  - extractor enum: pdf|docx|txt
  - status enum: TEXT_READY|ERROR
  - errorMessage optional

3. Extraction (server-side only):

- POST /api/contracts/:id/versions/:versionId/extract-text:
  - RBAC: VIEWER cannot extract.
  - Fetch the main Document for the version, download from storageKey (blob URL).
  - TXT: buffer -> utf-8 string
  - DOCX: use mammoth to extract raw text
  - PDF: attempt text extraction (pdf-parse or similar). If extracted text is empty, save ERROR with message "OCR not implemented yet".
  - Save ContractVersionText and update Document.ingestionStatus if present.
  - Idempotency:
    - If existing ContractVersionText is TEXT_READY, return it without re-extract unless force=true is provided.
    - If ERROR, allow retry.

- GET /api/contracts/:id/versions/:versionId/text:
  - Return status + preview + extractedAt + errorMessage (and optionally full text with a safe size limit).

4. UI:

- Update /contracts/[id] version cards:
  - Upload real file (not metadata-only)
  - Show ingestion status (UPLOADED/TEXT_READY/ERROR)
  - Button "Extract text" (disabled unless a document exists; show loading)
  - Preview extracted text: first N chars with "Show more" (collapsible)
  - Show extraction errors clearly.

5. Security & quality:

- Workspace scoping everywhere.
- Zod validation everywhere.
- No direct Prisma in route handlers (use repositories/services).
- Tests:
  - uploading second doc returns 409
  - txt extraction returns exact content
  - docx extraction returns non-empty text
  - pdf extraction returns TEXT_READY or ERROR (if no text layer)
  - VIEWER cannot upload/extract (403)

Deliverables:

- prisma migration
- storage service wrapper (upload + download)
- API routes + Zod schemas
- UI updates
- tests
- manual verification checklist

Implement STEP 5A: Policy Engine (deterministic, NO AI).

Context:

- STEP 4 complete: ContractVersionText exists with TEXT_READY or ERROR.
- Workspace-scoped system, RBAC enforced.
- No delete operations.

Goal:
Build a deterministic policy engine that evaluates contract versions against company-defined rules WITHOUT using AI.

1. Prisma models:
   Add:
   Policy

- id, workspaceId, name, description, isActive, createdAt

PolicyRule

- id, policyId
- clauseType enum
- ruleType enum (REQUIRED, FORBIDDEN, MIN_VALUE, MAX_VALUE, ALLOWED_VALUES)
- expectedValue (string|number|json)
- severity enum (LOW, MEDIUM, HIGH, CRITICAL)
- riskType enum (LEGAL, FINANCIAL, OPERATIONAL, DATA, SECURITY)
- weight number
- createdAt

ClauseFinding

- id
- contractVersionId
- clauseType
- ruleId
- complianceStatus enum (COMPLIANT, VIOLATION, UNCLEAR, NOT_APPLICABLE)
- severity
- riskType
- recommendation
- createdAt

ContractCompliance

- id
- contractVersionId (unique)
- policyId
- score (0–100)
- status enum (COMPLIANT, NEEDS_REVIEW, NON_COMPLIANT)
- createdAt

2. Clause taxonomy enum:
   TERMINATION, LIABILITY, INTELLECTUAL_PROPERTY, PAYMENT_TERMS, DATA_PRIVACY, CONFIDENTIALITY, GOVERNING_LAW, SLA, SCOPE, OTHER

3. Deterministic Policy Engine:
   Create policyEngine.ts:

- Input: contractVersionId, policyId
- For each PolicyRule:
  - If ruleType REQUIRED → if no clause provided → VIOLATION
  - Else mark NOT_APPLICABLE (for now)
- Create ClauseFinding records
- Compute score:
  - start 100
  - subtract weight per VIOLATION
  - CRITICAL caps score at max 40
- Compute status from score

(No AI, no clause extraction yet)

4. API:
   POST /api/contracts/:id/versions/:versionId/analyze

- RBAC: LEGAL/RISK/ADMIN
- Creates findings + compliance

GET /api/contracts/:id/versions/:versionId/compliance

- Returns score + findings

5. UI:

- Button “Analyze contract”
- Show score + findings list (basic)

6. Tests:

- REQUIRED rule missing → VIOLATION
- Score calculation deterministic
- Same input → same output

Deliverables:

- Prisma migration
- policyEngine service
- API routes
- UI basics
- Tests

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

Add PDF export to STEP 7 without changing existing pages or HTML export.

Current state:

- Version comparison pages already exist and work.
- HTML export already works.
- Do NOT refactor compare logic, UI pages, or existing HTML export.

Goal:
Add a real PDF export alongside the existing HTML export.

Requirements:

1. Keep existing HTML export exactly as-is.
2. Add PDF export as an additional option.

API change (minimal):

- Update existing POST /api/contracts/:id/compare/report
- Accept optional body param:
  { format?: "pdf" | "html" }
- Default behavior:
  - format === "html" → existing behavior (no changes)
  - format === "pdf" → NEW behavior:
    - generate PDF server-side
    - return binary PDF
    - headers:
      Content-Type: application/pdf
      Content-Disposition: attachment; filename="Contract_Compare_vX_vs_vY.pdf"

PDF generation:

- Use @react-pdf/renderer (Vercel-safe).
- Create new file ONLY:
  src/core/services/reports/versionComparePdf.tsx
  export async function buildComparePdf(result): Promise<Uint8Array>
- PDF content must match the existing HTML report structure:
  - contract title, policy
  - version summary + scores
  - delta improved/worsened
  - top drivers
  - changed clauses only

UI change (minimal):

- Keep existing “Export” (HTML).
- Add a second button near it:
  “Export PDF”
  → calls the same endpoint with { format: "pdf" }.
- No layout changes, no page restructuring.

Tests:

- Add ONE test:
  - format="pdf" returns Content-Type application/pdf and non-empty body.
- Do not touch existing HTML export tests.

Constraints:

- Do not remove or rewrite HTML export.
- Do not introduce new pages.
- Do not refactor compare logic.
- Keep changes minimal and isolated.

Deliverable:

- PDF export works in addition to existing HTML export.

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

Implement STEP 9A: Risk Aggregation & Deterministic Executive Summary (NO AI).

Context

- STEP 8C complete.
- ClauseExtraction (AI) exists but is NOT used here.
- ClauseFinding is deterministic and already includes:
  - clauseType
  - complianceStatus (COMPLIANT | VIOLATION | UNCLEAR | NOT_APPLICABLE | OVERRIDDEN)
  - severity
  - riskType
  - weight
  - confidence
  - recommendation
- ContractCompliance exists with:
  - rawScore
  - effectiveScore
  - status (COMPLIANT | NEEDS_REVIEW | NON_COMPLIANT)
- Exceptions can override findings.
- Ledger exists.

Goal
Add a deterministic “management-level” risk aggregation and executive summary layer
that:

1. Aggregates risk per category (riskType).
2. Produces an executive-friendly summary (deterministic, template-based).
3. Is exportable and visible in UI.
4. Does NOT change scoring, findings, or policy logic.

This step is a READ-ONLY AGGREGATION layer.

────────────────────────────────

1. RISK AGGREGATION MODEL (IN-MEMORY)
   ────────────────────────────────

Create types:
src/core/services/risk/riskAggregation.ts

export type RiskCluster = {
riskType: "LEGAL" | "FINANCIAL" | "OPERATIONAL" | "DATA" | "SECURITY";
level: "OK" | "NEEDS_REVIEW" | "MEDIUM" | "HIGH";
violationCount: number;
unclearCount: number;
overriddenCount: number;
maxSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
totalWeight: number;
topDrivers: Array<{
clauseType: string;
severity: string | null;
weight: number;
reason: string; // deterministic (from rule/recommendation)
}>;
};

export type RiskAggregation = {
contractId: string;
contractVersionId: string;
policyId: string;
overallStatus: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
rawScore: number;
effectiveScore: number;
clusters: RiskCluster[];
topDrivers: RiskCluster["topDrivers"]; // flattened, sorted by weight desc
generatedAt: string;
};

No Prisma table required (compute on the fly).

──────────────────────────────── 2) AGGREGATION LOGIC (DETERMINISTIC)
────────────────────────────────

Create:
src/core/services/risk/aggregateRisk.ts

Input:

- contractVersionId
- policyId

Load:

- ClauseFinding[] for the version + policy
- ContractCompliance for the version + policy

Aggregation rules:

For each riskType:

- violationCount = count findings with complianceStatus === VIOLATION
- unclearCount = count findings with complianceStatus === UNCLEAR
- overriddenCount = count findings with complianceStatus === OVERRIDDEN
- maxSeverity = highest severity among findings
- totalWeight = sum of weights for VIOLATION findings only
- topDrivers:
  - include only VIOLATION or UNCLEAR findings
  - sort by weight desc
  - max 3 per cluster

Cluster level rules:

- if any CRITICAL violation → HIGH
- else if violationCount > 0 → MEDIUM
- else if unclearCount > 0 → NEEDS_REVIEW
- else → OK

Overall status:

- if effectiveScore < 60 → NON_COMPLIANT
- else if any cluster.level in {HIGH, MEDIUM, NEEDS_REVIEW} → NEEDS_REVIEW
- else → COMPLIANT

──────────────────────────────── 3) EXECUTIVE SUMMARY (DETERMINISTIC TEXT)
────────────────────────────────

Create:
src/core/services/risk/executiveSummary.ts

Input:

- RiskAggregation

Output:
export type ExecutiveSummary = {
headline: string;
paragraphs: string[];
keyRisks: string[]; // bullets
recommendation: string;
};

Rules (template-based):

Headline:

- COMPLIANT → "Contract compliant with company standards."
- NEEDS_REVIEW → "Contract requires review before approval."
- NON_COMPLIANT → "Contract is not compliant with company standards."

Paragraph rules:

- Always mention overallStatus + effectiveScore.
- Mention top 1–2 risk clusters (by level then weight).

Key risks bullets:

- One bullet per top driver (max 3).

Recommendation:

- If NON_COMPLIANT → "Renegotiation or exception approval required."
- If NEEDS_REVIEW → "Legal or risk review recommended."
- If COMPLIANT → "Contract can proceed to approval."

NO AI.
NO randomness.

──────────────────────────────── 4) API
────────────────────────────────

Add:
GET /api/contracts/:id/versions/:versionId/risk-summary?policyId=...

- RBAC: VIEWER can read
- Validate workspace ownership
- Returns:
  {
  aggregation: RiskAggregation,
  summary: ExecutiveSummary
  }

──────────────────────────────── 5) UI
────────────────────────────────

A) Contract detail page (/contracts/[id])

For each analyzed version add a new section:
"Executive Risk Summary"

Show:

- Headline
- Overall score (effective/raw)
- Risk cluster table:
  - Risk type
  - Level badge
  - Violations / Unclear
- Key risks (bullets)
- Recommendation

This section is READ-ONLY.

B) Export

- Extend existing export (or add new button):
  “Export Executive Summary”
- PDF / HTML is fine (reuse existing export infra).
- This is management-facing (1–2 pages max).

──────────────────────────────── 6) LEDGER
────────────────────────────────

When executive summary is generated for export:

- Record LedgerEvent:
  type: REPORT_EXPORTED
  metadata:
  {
  "reportType": "EXECUTIVE_SUMMARY",
  "policyId": "...",
  "effectiveScore": 72
  }

──────────────────────────────── 7) TESTS
────────────────────────────────

- aggregateRisk:
  - correct cluster levels
  - violations vs unclear logic
- executiveSummary:
  - deterministic output for same input
  - headline matches overallStatus
- API:
  - workspace scoping
  - missing policyId → 400

──────────────────────────────── 8) MANUAL VERIFICATION CHECKLIST
────────────────────────────────

1. Analyze a contract with:
   - at least 1 VIOLATION
   - at least 1 UNCLEAR
2. Open contract detail.
3. See "Executive Risk Summary":
   - clusters visible
   - readable summary
4. Export executive summary.
5. Confirm PDF/HTML is readable by non-legal user.
6. Verify no score or finding changed.

Deliverables

- aggregateRisk service
- executiveSummary generator
- API route
- UI section
- export integration
- tests

Implement STEP 9B: AI-assisted Executive Risk Narrative (presentation layer only).

Context
• STEP 9A complete: deterministic Executive Risk Summary exists.
• Risk aggregation is already computed deterministically:
• score (raw / effective)
• violationCount
• unclearCount
• risk clusters per RiskType (LEGAL, FINANCIAL, DATA, etc.)
• key risks list (top drivers)
• ClauseExtraction and Policy Engine must NOT be changed.
• All calculations, scores, and risk levels remain 100% deterministic.
• We want to use AI only to phrase a human-readable executive narrative.
• Output must be management-ready, not legal analysis.

⸻

Goal

Add an AI-generated executive narrative that:
• explains the risk situation in natural language
• is based only on structured deterministic input
• does NOT influence score, compliance, or decisions
• is safe, reproducible, and auditable
• is optional (can be regenerated without side effects)

This narrative is presentation only.

⸻

Core Rule (VERY IMPORTANT)

AI never sees raw contract text.
AI never sees extracted clauses.
AI never decides compliance or risk.

AI receives only structured summary data.

⸻

1️⃣ Data fed to AI (STRICT INPUT)

Create a DTO used as the only AI input:

type ExecutiveNarrativeInput = {
contractTitle: string
policyName: string
score: number
status: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT"

violationCount: number
unclearCount: number

riskSummary: Array<{
riskType: "LEGAL" | "FINANCIAL" | "DATA" | "OPERATIONAL" | "SECURITY"
level: "OK" | "MEDIUM" | "NEEDS_REVIEW"
violations: number
unclear: number
}>

keyRisks: string[] // already human-readable, deterministic
}

No other data is allowed.

⸻

2️⃣ AI Service

Create:

src/core/services/reports/executiveNarrativeAI.ts

Function:

generateExecutiveNarrative(
input: ExecutiveNarrativeInput
): Promise<string>

Responsibilities:
• produce 1 short paragraph (3–5 sentences max)
• business / executive tone
• no legal advice
• no suggestions outside provided data

⸻

3️⃣ AI Prompt (internal, fixed)

Use this exact prompt structure:

You are generating an executive-level risk summary for a business audience.

Use ONLY the structured data provided.
Do NOT invent facts.
Do NOT add legal advice.
Do NOT mention missing clauses or raw contract text.

The goal is to explain:
• overall risk posture
• why the contract requires or does not require review
• which risk areas are most relevant

Keep the tone professional, neutral, and concise.

Then pass the structured JSON input.

⸻

4️⃣ Deterministic Guardrails

Before calling AI:
• If violationCount === 0 and unclearCount === 0
• You MAY skip AI and show a static sentence:
“This contract does not present material risks under the selected policy.”
• If AI fails:
• fallback to deterministic executive sentence from STEP 9A

AI output is never persisted as source of truth.

⸻

5️⃣ API

Add endpoint:

POST /api/contracts/:id/executive-narrative

Body:

{ "policyId": "..." }

Behavior:
• computes ExecutiveNarrativeInput deterministically
• calls AI
• returns { narrative: string }

RBAC:
• VIEWER: read-only allowed
• LEGAL / RISK / ADMIN: allowed

⸻

6️⃣ UI

In Executive Risk Summary panel:
• Add section:
“Executive Narrative (AI-generated)”
• Show paragraph text
• Add small label:
“Generated from structured risk data”
• Optional button:
“Regenerate narrative” (same input, no side effects)

⸻

7️⃣ Ledger (optional, lightweight)

Do NOT add new enum.

Optionally attach to existing event:
• type: ANALYSIS_RUN
• metadata:

{
"executiveNarrativeGenerated": true
}

⸻

8️⃣ Tests
• AI is never called with raw text
• Same input → deterministic structure (content may vary linguistically)
• Narrative exists even if AI fails (fallback works)
• No score/compliance changes after generation

⸻

9️⃣ Manual Verification Checklist 1. Analyze a contract with violations. 2. Open Executive Risk Summary. 3. See:
• deterministic summary (STEP 9A)
• AI narrative below it 4. Narrative:
• matches score and risks
• mentions key areas (LEGAL / FINANCIAL / DATA)
• does NOT mention clauses, pages, or contract text 5. Regenerate narrative → no data changes.

⸻

Deliverables
• executiveNarrativeAI.ts
• API endpoint
• UI integration
• guardrails + fallback
• tests

⸻

Important reminder

This step adds zero risk to the system.
It improves:
• readability
• sales
• executive adoption

without touching:
• policy logic
• scoring
• compliance
• auditability

⸻

Implement STEP 9C: Executive Export Pack (PDF + HTML/MD) for the Executive Risk Summary.

Context
• STEP 9A exists: deterministic risk aggregation + executive summary data (per policy, per contract/version).
• STEP 9B exists: AI narrative generated from structured risk data (regeneratable).
• We already have exports in STEP7 (compare report) with HTML and PDF support (likely using @react-pdf/renderer or equivalent).
• Must remain audit-safe:
• scoring and compliance are deterministic
• AI is ONLY used for narrative text (optional)

Goal

Add a single, management-ready export for the Executive Risk Summary page:
• PDF (primary)
• HTML and Markdown (secondary, downloadable)
Export must include:

    1.	Contract metadata (title, counterparty, contractType, version, dates)
    2.	Contract decision headline (COMPLIANT / NEEDS_REVIEW / NON_COMPLIANT)
    3.	Score (raw + effective)
    4.	Risk clusters table (riskType -> level, violations, unclear)
    5.	Key risks list (top 5 drivers, deterministic)
    6.	Approved exceptions snapshot (if any) — counts + list (optional but nice)
    7.	AI narrative (if present) with label “AI-generated narrative (from structured risk data)”
    8.	Footer: generatedAt, workspace, policy name

Constraints
• Workspace scoped + RBAC enforced
• VIEWER can download HTML/MD, but PDF export only for LEGAL/RISK/ADMIN (or same rule you used in STEP7).
• Do NOT change scoring logic.
• Do NOT introduce new migrations unless strictly needed.
• Avoid N+1 queries (use one server query that returns everything required).

⸻

1. API

Add endpoints

GET /api/contracts/:id/executive-summary?policyId=...&versionId=...
• returns a normalized “export-ready” object:
• contract info
• selected version info
• summary (score, decision, clusters, keyRisks)
• narrative (string | null)
• exceptions summary (optional)
• RBAC: VIEWER can read

POST /api/contracts/:id/executive-summary/export
Body:

{
"policyId": "…",
"versionId": "…",
"format": "pdf" | "html" | "md",
"includeNarrative": true | false
}

    •	For pdf: return application/pdf streamed download
    •	For html: return text/html
    •	For md: return text/markdown
    •	RBAC:
    •	html/md: any authenticated workspace member (VIEWER allowed)
    •	pdf: LEGAL/RISK/ADMIN only (or consistent with STEP7)

Ledger

Record LedgerEventType (if already added in enum) OR reuse existing:
• If you already have a generic export event type: use it.
• Otherwise do NOT add new enum values now (avoid migration pain).
• Instead: record POLICY_RULE_UPDATED etc is irrelevant — add a LedgerEvent with:
• type: ANALYSIS_RUN (or another existing safe type) is wrong.
• Prefer: add metadata.action = "EXECUTIVE_EXPORT" and keep type = "REPORT_EXPORTED" only if enum exists.
If no suitable type exists, log with the closest existing OR skip ledger for MVP.
(Prefer logging if you already have something like REPORT_EXPORTED.)

⸻

2. Report builder service

Create:
src/core/services/reports/executiveSummaryReport.ts

Exports:

export type ExecutiveExportModel = { ... };

export function buildExecutiveMarkdown(model: ExecutiveExportModel): string;
export function buildExecutiveHtml(model: ExecutiveExportModel): string;
export async function buildExecutivePdf(model: ExecutiveExportModel): Promise<Uint8Array | Buffer>;

PDF implementation
• Reuse the same PDF stack used in STEP7 (DO NOT introduce a second library).
• If STEP7 uses @react-pdf/renderer, implement a new PDF component:
• ExecutiveSummaryPdf.tsx
• Layout: 1–2 pages max, clean, “board-ready”.

PDF sections order:
• Title + subtitle (contract, policy)
• Decision headline + effective score
• Risk clusters table
• Key risks bullets
• Exceptions snapshot (optional)
• AI narrative block (optional)
• Footer

⸻

3. UI changes

On the Executive Risk Summary UI (where you have dropdown policy + export button already):
• Replace/extend current export:
• Dropdown “Export format”: PDF / HTML / Markdown
• Checkbox: “Include AI narrative”
• Button “Export Executive Summary”
• On click:
• call POST export endpoint
• trigger browser download with correct filename:
• ExecutiveSummary*<contractTitle>\_v<version>*<policy>.pdf
• Show visible success/error states.

⸻

4. Contract detail integration (optional but recommended)

In /contracts/[id] compliance section:
• add small link:
• “Open Executive Summary”
• goes to /contracts/[id]/executive?versionId=…&policyId=…
(if page exists already, just add link; otherwise skip)

⸻

5. Tests (Vitest)

Add tests: 1. executiveSummaryReport.test.ts

    •	markdown contains: contract title, score, decision
    •	html contains: key risks items

    2.	export/route.test.ts

    •	VIEWER can export html/md (200)
    •	VIEWER cannot export pdf (403)
    •	LEGAL/RISK/ADMIN can export pdf (200, content-type pdf)

    3.	Ensure export does not change DB state except optional ledger event.

⸻

6. Manual verification checklist
   1. Open contract → Executive Risk Summary
   2. Select policy and version (if selectable)
   3. Export:
      • HTML downloads and opens in browser
      • MD downloads
      • PDF downloads and is readable (1–2 pages)
   4. Toggle “Include AI narrative”:
      • ON: narrative appears with label “AI-generated”
      • OFF: narrative section hidden
   5. Login as VIEWER:
      • export html/md works
      • export pdf forbidden
   6. Verify no scoring changes after export.

⸻

Deliverables
• API endpoints (GET model + POST export)
• executiveSummaryReport builder (md/html/pdf)
• UI export controls + download behavior
• tests + manual checklist
• (optional) ledger export event metadata

Important: Do not refactor existing scoring/compliance. Only read existing computed structures and generate exports.

⸻

Implement STEP 10: Portfolio Risk Dashboard (C-level overview).

Context:
• We have Contracts, Versions, Policies, ClauseFindings, ContractCompliance (raw/effective), Exceptions, Ledger.
• EffectiveScore must consider approved exceptions.
• UI already exists for contract detail, compare, executive summary export.

Goal:
Create a workspace-level dashboard that lists all contracts with their latest risk posture and allows filtering by riskType/status for executive overview.

Requirements: 1. Data aggregation (server-side):

    •	For each contract, pick the latest version (max versionNumber or latest createdAt).
    •	For that version, pick compliance for a selected policy (default: first active policy).
    •	Compute:
    •	effectiveScore, status
    •	counts: violations, unclear, overridden (approved exceptions)
    •	riskType breakdown (LEGAL/FINANCIAL/OPERATIONAL/DATA/SECURITY): counts of violations + unclear
    •	exceptions: requested/open, approved
    •	lastAnalyzedAt (from compliance createdAt or ledger ANALYSIS_RUN)

    2.	API:

    •	GET /api/dashboard/contracts

Query:
• policyId? (optional, default active)
• status? (COMPLIANT|NEEDS_REVIEW|NON_COMPLIANT)
• riskType? (LEGAL|FINANCIAL|OPERATIONAL|DATA|SECURITY)
• counterpartyId?
• hasOpenExceptions? boolean
• hasUnclear? boolean
• q? (search by title/counterparty)
• page, pageSize, sort
RBAC: VIEWER can read.
Workspace-scoped, no N+1 (use Prisma includes/aggregations).

    3.	UI page:

    •	Create /dashboard (or /portfolio) page.
    •	Top controls:
    •	policy dropdown
    •	filters (status, riskType, hasOpenExceptions, hasUnclear)
    •	search input
    •	Table:
    •	Contract title + counterparty
    •	Status badge
    •	EffectiveScore
    •	Violations / Unclear / Overridden counts
    •	Top risk types (chips)
    •	Last analyzed
    •	Link “Open” → /contracts/[id]
    •	Add nav link “Dashboard” in AppLayout.

    4.	Tests:

    •	API returns only workspace contracts.
    •	Filtering by riskType works.
    •	Contract with approved exception shows higher effectiveScore and overridden count.
    •	VIEWER has access.

    5.	Manual verification checklist:

    •	Analyze at least 2 contracts with different outcomes.
    •	Go to /dashboard:
    •	Verify rows match contract detail compliance.
    •	Filters change results.
    •	Clicking opens contract detail.

Deliverables:
• dashboard repo/service (aggregation)
• api route + zod
• ui page
• tests

Implement STEP 11: Deal Desk Mode (premium) end-to-end.

Context
• We already have: Contracts, Versions, Documents upload + text extraction, ClauseExtraction (AI), ClauseFindings, ContractCompliance (raw/effective), Exceptions workflow, Ledger events.
• STEP 7 compare exists (vA vs vB risk delta + export).
• STEP 9 provides executive risk summary + AI narrative generation from structured risk data.
• STEP 10 provides Portfolio Risk Dashboard.

Goal
Create a “Deal Desk” workflow for a single contract version under a selected policy: 1. Combine analysis + exceptions + compare + executive narrative into a single decision view. 2. Produce a deterministic decision recommendation: GO / NO-GO / NEEDS_REVIEW (no AI for the decision). 3. Allow legal/risk/admin to “approve” a final decision record with audit trail. 4. Export a management-ready Deal Desk report (PDF + HTML).

Non-goals
• Do NOT change core scoring rules.
• AI can generate narrative text, but decision logic must be deterministic.

──────────────────────────────── 1. Prisma models
────────────────────────────────

Add enums:
DealDecisionStatus: DRAFT | FINAL
DealDecisionOutcome: GO | NO_GO | NEEDS_REVIEW

Add model DealDecision:
• id
• workspaceId
• contractId
• contractVersionId
• policyId
• status DealDecisionStatus (default DRAFT)
• outcome DealDecisionOutcome
• rationale Text (deterministic explanation + key drivers)
• executiveSummary Text (can be AI-generated from structured data; optional)
• createdByUserId
• finalizedByUserId (nullable)
• finalizedAt (nullable)
• createdAt
• updatedAt

Constraints:
• @@unique([contractVersionId, policyId]) // one decision per version+policy

Migrations allowed.

──────────────────────────────── 2) Deterministic decision engine
────────────────────────────────

Create:
src/core/services/dealDesk/dealDecisionEngine.ts

Input:
• contractVersionId
• policyId

Load:
• compliance (raw/effective score, status)
• findings (policy rules) including:
• complianceStatus (VIOLATION/UNCLEAR/COMPLIANT/NOT_APPLICABLE)
• severity, riskType, weight, recommendation
• overridden flag (approved exception linked)
• exceptions:
• open exceptions count (REQUESTED)
• approved exceptions count
• optional: latest comparison vs previous version (if exists) to show trend (but decision must not require compare)

Decision logic (deterministic, must be reproducible):
• Let effectiveScore = compliance.effectiveScore
• Let violations = count findings where status==VIOLATION and not overridden
• Let criticalViolations = count findings where severity==CRITICAL and status==VIOLATION and not overridden
• Let unclear = count findings where status==UNCLEAR
• Let openExceptions = count exceptions with status==REQUESTED
Rules:

    1.	If criticalViolations > 0 → outcome = NO_GO
    2.	Else if effectiveScore < 60 → outcome = NO_GO
    3.	Else if violations > 0 → outcome = NEEDS_REVIEW
    4.	Else if unclear > 0 → outcome = NEEDS_REVIEW
    5.	Else if openExceptions > 0 → outcome = NEEDS_REVIEW
    6.	Else → outcome = GO

Rationale builder (deterministic):
• Provide bullet reasons:
• “Effective score: 72/100”
• “Violations: 1 (FINANCIAL: LIABILITY)”
• “Unclear: 2 (LEGAL: CONFIDENTIALITY, DATA: DATA_PRIVACY)”
• “Approved exceptions: 1”
• “Open exception requests: 1”
• Include top 5 drivers:
• highest weights among violations/unclear
• Include riskType clustering summary (reuse STEP 9 aggregation)

Output:
type DealDecisionPreview = {
contractId
contractVersionId
policyId
effectiveScore
rawScore
outcome
statusSuggestion: “DRAFT”
counts: { violations, criticalViolations, unclear, overridden, openExceptions, approvedExceptions }
topDrivers: Array<{ clauseType, riskType, severity, weight, status, recommendation }>
rationaleMarkdown: string
}

No AI calls here.

──────────────────────────────── 3) Ledger integration
────────────────────────────────

Add LedgerEventType values (if you prefer avoiding enum migration pain, store metadata with existing types; but best is new enum values now):
• DEAL_DECISION_DRAFTED
• DEAL_DECISION_FINALIZED
• DEAL_DESK_REPORT_EXPORTED

Record events:
• when decision saved (draft) → DEAL_DECISION_DRAFTED
• when finalized → DEAL_DECISION_FINALIZED
• when exporting report → DEAL_DESK_REPORT_EXPORTED

Include metadata:
• outcome, effectiveScore, violations/unclear counts, policyId

──────────────────────────────── 4) API routes
────────────────────────────────

All workspace-scoped, RBAC enforced.

A) GET /api/contracts/:id/versions/:versionId/deal-desk?policyId=…
RBAC: VIEWER can read
Returns:
• deal decision preview (computed)
• existing DealDecision if exists (draft/final)
• compliance + findings + exceptions summary (for UI)

If missing analysis for that version/policy → 409 MISSING_ANALYSIS with details.

B) POST /api/contracts/:id/versions/:versionId/deal-desk/draft
Body: { policyId, executiveSummary? } // executiveSummary optional (AI-generated separately)
RBAC: LEGAL/RISK/ADMIN
Creates or updates DealDecision as DRAFT using engine output for outcome + rationale.
If user supplies executiveSummary store it.

C) POST /api/contracts/:id/versions/:versionId/deal-desk/finalize
Body: { policyId }
RBAC: LEGAL/RISK/ADMIN only
Sets status=FINAL, finalizedByUserId, finalizedAt.
Must be idempotent (finalizing twice returns existing).
If decision doesn’t exist yet, create from engine output then finalize.

D) POST /api/contracts/:id/versions/:versionId/deal-desk/narrative
Body: { policyId }
RBAC: LEGAL/RISK/ADMIN
Uses AI to generate executiveSummary text ONLY from structured data:
• compliance scores/status
• risk type aggregation
• key risks list (top drivers)
• exceptions summary
DO NOT pass raw contract text.
Returns generated narrative string; store on DealDecision (draft) optionally.

E) POST /api/contracts/:id/versions/:versionId/deal-desk/report
Body: { policyId, format: “pdf”|“html” }
RBAC: LEGAL/RISK/ADMIN
Generates management-ready report from structured data + decision record:
• if DealDecision exists use it; else compute preview
Return downloadable file:
• pdf: application/pdf
• html: text/html

Zod validate all payloads.

──────────────────────────────── 5) UI: Deal Desk page
────────────────────────────────

Add route:
A) /contracts/[id]/deal-desk?versionId=…&policyId=…

Entry points:
• On contract detail page, per version add button “Deal Desk”.
• On compare page, add shortcut “Open Deal Desk for v2”.

UI layout (single page, exec-friendly): 1. Header: Contract title + counterparty + version number + policy selector 2. “Decision” card:
• Outcome badge: GO / NO-GO / NEEDS_REVIEW
• Effective score + status
• Counts (Violations, Unclear, Overridden, Open exceptions) 3. “Key risks” (top drivers list) 4. “Exceptions” panel:
• open requests + approved list with links 5. “Comparison” panel (if previous version exists):
• link to compare page, show delta improved/worsened (optional) 6. “Executive Narrative (AI-generated)” box:
• Button “Generate narrative”
• Shows narrative text
• Disclaimer: “Generated from structured risk data” 7. Actions:
• “Save Draft”
• “Finalize decision”
• “Export report (PDF)”
• “Export report (HTML)”

RBAC:
• VIEWER can view but buttons disabled (draft/finalize/generate/export)
• LEGAL/RISK/ADMIN can do actions

Show clear empty states:
• Missing analysis → show “Analyze contract first” link to contract detail
• Missing extractions (optional) → still ok if findings exist

──────────────────────────────── 6) Report generator
────────────────────────────────

Create:
src/core/services/reports/dealDeskReport.ts

Functions:
• buildDealDeskHtml(payload): string
• buildDealDeskPdf(payload): Buffer (use same PDF approach as STEP 7)

Report sections:
• Contract + policy + version
• Decision outcome + effective score
• Risk table by riskType (violations/unclear/overridden)
• Key risks list with recommendations
• Exceptions summary (approved + open)
• Optional narrative section (if present)
• Footer: workspace + generated at

Ensure “management-ready” formatting.

──────────────────────────────── 7) Tests
────────────────────────────────

Unit tests:
• dealDecisionEngine:
• critical violation => NO_GO
• effectiveScore < 60 => NO_GO
• violations >0 => NEEDS_REVIEW
• unclear >0 => NEEDS_REVIEW
• openExceptions >0 => NEEDS_REVIEW
• else GO
• overridden violations don’t count
API tests:
• VIEWER cannot draft/finalize/export (403)
• workspace scoping enforced
• finalize is idempotent
• narrative endpoint does not include contract raw text (validate prompt input source is structured-only)
Report tests:
• html/pdf generation returns non-empty output and includes outcome/score

──────────────────────────────── 8) Manual verification checklist
──────────────────────────────── 1. Analyze a contract version with at least 1 violation and 1 unclear. 2. Open Deal Desk:
• Outcome should be NEEDS_REVIEW or NO_GO based on rules 3. Create an exception and approve it:
• overridden count increases, effective score may increase
• outcome may change deterministically 4. Generate narrative:
• should mention score, categories, key risks 5. Save draft then finalize:
• status becomes FINAL, ledger shows events 6. Export PDF/HTML and verify content. 7. VIEWER: can view page but cannot click actions.

Deliverables
• Prisma migration (DealDecision + enums)
• dealDecisionEngine service
• Deal Desk API routes + zod
• UI page + entry points
• Report generator (PDF + HTML)
• Ledger events for actions
• Tests + manual checklist
