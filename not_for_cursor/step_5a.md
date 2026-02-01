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
