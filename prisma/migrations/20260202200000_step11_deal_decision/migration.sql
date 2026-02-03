-- STEP 11: Deal Desk - DealDecision model and enums

-- 1) LedgerEventType: add Deal Desk event types
ALTER TYPE "LedgerEventType" ADD VALUE IF NOT EXISTS 'DEAL_DECISION_DRAFTED';
ALTER TYPE "LedgerEventType" ADD VALUE IF NOT EXISTS 'DEAL_DECISION_FINALIZED';
ALTER TYPE "LedgerEventType" ADD VALUE IF NOT EXISTS 'DEAL_DESK_REPORT_EXPORTED';

-- 2) Create DealDecisionStatus enum
CREATE TYPE "DealDecisionStatus" AS ENUM ('DRAFT', 'FINAL');

-- 3) Create DealDecisionOutcome enum
CREATE TYPE "DealDecisionOutcome" AS ENUM ('GO', 'NO_GO', 'NEEDS_REVIEW');

-- 4) Create DealDecision table
CREATE TABLE "DealDecision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "DealDecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "outcome" "DealDecisionOutcome" NOT NULL,
    "rationale" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "finalizedByUserId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealDecision_pkey" PRIMARY KEY ("id")
);

-- 5) Unique constraint: one decision per version+policy
CREATE UNIQUE INDEX "DealDecision_contractVersionId_policyId_key" ON "DealDecision"("contractVersionId", "policyId");

-- 6) Index for workspace listing
CREATE INDEX "DealDecision_workspaceId_createdAt_idx" ON "DealDecision"("workspaceId", "createdAt");

-- 7) Foreign keys
ALTER TABLE "DealDecision" ADD CONSTRAINT "DealDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDecision" ADD CONSTRAINT "DealDecision_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDecision" ADD CONSTRAINT "DealDecision_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDecision" ADD CONSTRAINT "DealDecision_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
