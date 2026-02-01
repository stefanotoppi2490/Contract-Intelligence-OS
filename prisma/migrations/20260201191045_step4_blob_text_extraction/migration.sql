-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('UPLOADED', 'TEXT_READY', 'ERROR');

-- CreateEnum
CREATE TYPE "TextExtractor" AS ENUM ('PDF', 'DOCX', 'TXT');

-- CreateEnum
CREATE TYPE "TextStatus" AS ENUM ('TEXT_READY', 'ERROR');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "ingestionStatus" "IngestionStatus" DEFAULT 'UPLOADED',
ADD COLUMN     "lastError" TEXT;

-- CreateTable
CREATE TABLE "ContractVersionText" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractor" "TextExtractor" NOT NULL,
    "status" "TextStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractVersionText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersionText_contractVersionId_key" ON "ContractVersionText"("contractVersionId");

-- CreateIndex
CREATE INDEX "ContractVersionText_contractVersionId_idx" ON "ContractVersionText"("contractVersionId");

-- AddForeignKey
ALTER TABLE "ContractVersionText" ADD CONSTRAINT "ContractVersionText_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
