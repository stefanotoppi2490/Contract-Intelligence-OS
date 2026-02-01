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
