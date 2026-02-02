/**
 * Environment variables validated at runtime (Zod).
 */

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // NextAuth (Auth.js)
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required for production").optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  // Vercel Blob (optional in dev; required for upload on Vercel)
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  // Gemini (STEP 5B; optional so tests can run without key)
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

export const env = loadEnv();
