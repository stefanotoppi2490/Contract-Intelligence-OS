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
