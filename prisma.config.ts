import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL optional for `prisma generate`; required for migrate/studio.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/contract_intelligence",
  },
});
