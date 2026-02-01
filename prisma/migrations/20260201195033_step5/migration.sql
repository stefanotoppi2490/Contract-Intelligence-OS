/*
  Warnings:

  - Made the column `isActive` on table `Policy` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ClauseFinding" ALTER COLUMN "complianceStatus" DROP DEFAULT,
ALTER COLUMN "clauseType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Policy" ALTER COLUMN "isActive" SET NOT NULL;
