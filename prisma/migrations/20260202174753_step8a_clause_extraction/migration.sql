-- CreateTable
CREATE TABLE "ClauseExtraction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "clauseType" "ClauseTaxonomy" NOT NULL,
    "extractedValue" JSONB,
    "extractedText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceLocation" JSONB,
    "extractedBy" TEXT NOT NULL DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClauseExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClauseExtraction_contractVersionId_idx" ON "ClauseExtraction"("contractVersionId");

-- CreateIndex
CREATE INDEX "ClauseExtraction_clauseType_idx" ON "ClauseExtraction"("clauseType");

-- CreateIndex
CREATE UNIQUE INDEX "ClauseExtraction_contractVersionId_clauseType_key" ON "ClauseExtraction"("contractVersionId", "clauseType");

-- AddForeignKey
ALTER TABLE "ClauseExtraction" ADD CONSTRAINT "ClauseExtraction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClauseExtraction" ADD CONSTRAINT "ClauseExtraction_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
