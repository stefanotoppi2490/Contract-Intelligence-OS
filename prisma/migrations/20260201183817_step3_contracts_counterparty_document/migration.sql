/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,name]` on the table `Counterparty` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `title` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CounterpartyType" AS ENUM ('CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SIGNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'INTEGRATION');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Counterparty" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "type" "CounterpartyType" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD';

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_workspaceId_name_key" ON "Counterparty"("workspaceId", "name");
