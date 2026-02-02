-- STEP 5B: AI extraction fields on ClauseFinding
ALTER TABLE "ClauseFinding" ADD COLUMN IF NOT EXISTS "foundText" TEXT;
ALTER TABLE "ClauseFinding" ADD COLUMN IF NOT EXISTS "foundValue" JSONB;
ALTER TABLE "ClauseFinding" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "ClauseFinding" ADD COLUMN IF NOT EXISTS "parseNotes" TEXT;
ALTER TABLE "ClauseFinding" ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3);
ALTER TABLE "ClauseFinding" ADD COLUMN IF NOT EXISTS "engineVersion" TEXT;
