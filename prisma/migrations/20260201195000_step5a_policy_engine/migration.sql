-- STEP 5A: Policy Engine (deterministic)
-- New enums
CREATE TYPE "ClauseTaxonomy" AS ENUM ('TERMINATION', 'LIABILITY', 'INTELLECTUAL_PROPERTY', 'PAYMENT_TERMS', 'DATA_PRIVACY', 'CONFIDENTIALITY', 'GOVERNING_LAW', 'SLA', 'SCOPE', 'OTHER');
CREATE TYPE "PolicyRuleType" AS ENUM ('REQUIRED', 'FORBIDDEN', 'MIN_VALUE', 'MAX_VALUE', 'ALLOWED_VALUES');
CREATE TYPE "FindingComplianceStatus" AS ENUM ('COMPLIANT', 'VIOLATION', 'UNCLEAR', 'NOT_APPLICABLE');
CREATE TYPE "ComplianceStatusType" AS ENUM ('COMPLIANT', 'NEEDS_REVIEW', 'NON_COMPLIANT');

-- Policy: add new columns
ALTER TABLE "Policy" ADD COLUMN "name" TEXT, ADD COLUMN "description" TEXT, ADD COLUMN "isActive" BOOLEAN DEFAULT true;
UPDATE "Policy" SET "name" = COALESCE("policyId", 'Legacy'), "description" = '', "isActive" = true WHERE "name" IS NULL;
ALTER TABLE "Policy" ALTER COLUMN "name" SET NOT NULL;

-- Policy: drop old unique and indexes
DROP INDEX IF EXISTS "Policy_workspaceId_policyId_key";
DROP INDEX IF EXISTS "Policy_workspaceId_clauseType_idx";

-- Policy: drop old columns
ALTER TABLE "Policy" DROP COLUMN IF EXISTS "policyId", DROP COLUMN IF EXISTS "clauseType", DROP COLUMN IF EXISTS "ruleType", DROP COLUMN IF EXISTS "expectedValue", DROP COLUMN IF EXISTS "severity", DROP COLUMN IF EXISTS "riskType", DROP COLUMN IF EXISTS "partyBias", DROP COLUMN IF EXISTS "recommendedAction", DROP COLUMN IF EXISTS "allowException";

-- PolicyRule table
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "clauseType" "ClauseTaxonomy" NOT NULL,
    "ruleType" "PolicyRuleType" NOT NULL,
    "expectedValue" JSONB,
    "severity" "Severity",
    "riskType" "RiskType",
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PolicyRule_policyId_clauseType_idx" ON "PolicyRule"("policyId", "clauseType");
CREATE INDEX "PolicyRule_policyId_createdAt_idx" ON "PolicyRule"("policyId", "createdAt");
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One PolicyRule per existing Policy (so FK can be satisfied)
INSERT INTO "PolicyRule" ("id", "policyId", "clauseType", "ruleType", "weight", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'OTHER', 'REQUIRED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Policy";

-- ClauseFinding: drop old data and reshape (ruleId required)
DELETE FROM "ClauseFinding";
DROP INDEX IF EXISTS "ClauseFinding_contractVersionId_clauseType_key";
ALTER TABLE "ClauseFinding" DROP COLUMN IF EXISTS "extractedValues", DROP COLUMN IF EXISTS "evidenceAnchors", DROP COLUMN IF EXISTS "confidence";
ALTER TABLE "ClauseFinding" ADD COLUMN "ruleId" TEXT REFERENCES "PolicyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE, ADD COLUMN "complianceStatus" "FindingComplianceStatus" DEFAULT 'NOT_APPLICABLE', ADD COLUMN "severity" "Severity", ADD COLUMN "riskType" "RiskType", ADD COLUMN "recommendation" TEXT;
ALTER TABLE "ClauseFinding" ADD COLUMN "clauseTypeNew" "ClauseTaxonomy" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "ClauseFinding" DROP COLUMN "clauseType";
ALTER TABLE "ClauseFinding" RENAME COLUMN "clauseTypeNew" TO "clauseType";
ALTER TABLE "ClauseFinding" ALTER COLUMN "ruleId" SET NOT NULL, ALTER COLUMN "complianceStatus" SET NOT NULL;
CREATE UNIQUE INDEX "ClauseFinding_contractVersionId_ruleId_key" ON "ClauseFinding"("contractVersionId", "ruleId");

-- ContractCompliance table
CREATE TABLE "ContractCompliance" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "ComplianceStatusType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractCompliance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContractCompliance_contractVersionId_policyId_key" ON "ContractCompliance"("contractVersionId", "policyId");
CREATE INDEX "ContractCompliance_contractVersionId_createdAt_idx" ON "ContractCompliance"("contractVersionId", "createdAt");
ALTER TABLE "ContractCompliance" ADD CONSTRAINT "ContractCompliance_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractCompliance" ADD CONSTRAINT "ContractCompliance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
