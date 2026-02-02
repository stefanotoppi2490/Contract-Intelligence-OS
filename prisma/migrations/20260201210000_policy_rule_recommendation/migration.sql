-- Add required recommendation to PolicyRule (default for existing rows)
ALTER TABLE "PolicyRule" ADD COLUMN "recommendation" TEXT NOT NULL DEFAULT 'Clause required by policy is missing or not detected.';
ALTER TABLE "PolicyRule" ALTER COLUMN "recommendation" DROP DEFAULT;
