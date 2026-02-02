-- Step 6: Exceptions + Ledger
-- 1) ExceptionStatus: safe enum replacement (PENDING -> REQUESTED, add WITHDRAWN)
CREATE TYPE "ExceptionStatus_new" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');
ALTER TABLE "ExceptionRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ExceptionRequest" ALTER COLUMN "status" TYPE "ExceptionStatus_new" USING (CASE WHEN status::text = 'PENDING' THEN 'REQUESTED' ELSE status::text END)::"ExceptionStatus_new";
ALTER TABLE "ExceptionRequest" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
DROP TYPE "ExceptionStatus";
ALTER TYPE "ExceptionStatus_new" RENAME TO "ExceptionStatus";

-- 2) New enums
CREATE TYPE "ExceptionDecision" AS ENUM ('APPROVE', 'REJECT');

CREATE TYPE "LedgerEventType" AS ENUM (
  'CONTRACT_UPLOADED',
  'TEXT_EXTRACTED',
  'ANALYSIS_RUN',
  'EXCEPTION_REQUESTED',
  'EXCEPTION_APPROVED',
  'EXCEPTION_REJECTED',
  'EXCEPTION_WITHDRAWN',
  'POLICY_CREATED',
  'POLICY_RULE_CREATED',
  'POLICY_RULE_UPDATED',
  'POLICY_RULE_DELETED'
);

-- 3) ExceptionRequest: add columns (nullable first for backfill)
ALTER TABLE "ExceptionRequest" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ExceptionRequest" ADD COLUMN "contractId" TEXT;
ALTER TABLE "ExceptionRequest" ADD COLUMN "clauseFindingId" TEXT;
ALTER TABLE "ExceptionRequest" ADD COLUMN "clauseType" TEXT;
ALTER TABLE "ExceptionRequest" ADD COLUMN "title" TEXT;
ALTER TABLE "ExceptionRequest" ADD COLUMN "decisionReason" TEXT;

UPDATE "ExceptionRequest" er SET
  "workspaceId" = c."workspaceId",
  "contractId" = v."contractId",
  "title" = COALESCE(NULLIF(TRIM(er."justification"), ''), 'Legacy exception'),
  "justification" = COALESCE(er."justification", '')
FROM "ContractVersion" v
JOIN "Contract" c ON c.id = v."contractId"
WHERE v.id = er."contractVersionId";

UPDATE "ExceptionRequest" SET "requestedByUserId" = '' WHERE "requestedByUserId" IS NULL;

ALTER TABLE "ExceptionRequest" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ExceptionRequest" ALTER COLUMN "contractId" SET NOT NULL;
ALTER TABLE "ExceptionRequest" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "ExceptionRequest" ALTER COLUMN "justification" SET NOT NULL;
ALTER TABLE "ExceptionRequest" ALTER COLUMN "requestedByUserId" SET NOT NULL;

ALTER TABLE "ExceptionRequest" ALTER COLUMN "policyId" DROP NOT NULL;
ALTER TABLE "ExceptionRequest" DROP CONSTRAINT IF EXISTS "ExceptionRequest_policyId_fkey";
ALTER TABLE "ExceptionRequest" ADD CONSTRAINT "ExceptionRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) ExceptionRequest: add workspace FK
ALTER TABLE "ExceptionRequest" ADD CONSTRAINT "ExceptionRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) ExceptionComment
CREATE TABLE "ExceptionComment" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExceptionComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExceptionComment_exceptionId_idx" ON "ExceptionComment"("exceptionId");

-- 6) LedgerEvent
CREATE TABLE "LedgerEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "LedgerEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contractId" TEXT,
    "contractVersionId" TEXT,
    "policyId" TEXT,
    "exceptionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LedgerEvent_workspaceId_createdAt_idx" ON "LedgerEvent"("workspaceId", "createdAt");
CREATE INDEX "LedgerEvent_workspaceId_type_idx" ON "LedgerEvent"("workspaceId", "type");

ALTER TABLE "LedgerEvent" ADD CONSTRAINT "LedgerEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) ExceptionRequest: clauseFinding FK
ALTER TABLE "ExceptionRequest" ADD CONSTRAINT "ExceptionRequest_clauseFindingId_fkey" FOREIGN KEY ("clauseFindingId") REFERENCES "ClauseFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- policyId FK already exists; only made nullable above

ALTER TABLE "ExceptionComment" ADD CONSTRAINT "ExceptionComment_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "ExceptionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8) Indexes ExceptionRequest
CREATE INDEX "ExceptionRequest_workspaceId_status_idx" ON "ExceptionRequest"("workspaceId", "status");
CREATE INDEX "ExceptionRequest_clauseFindingId_idx" ON "ExceptionRequest"("clauseFindingId");
