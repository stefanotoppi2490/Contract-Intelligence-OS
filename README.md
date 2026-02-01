This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database (Prisma + PostgreSQL)

- **Local Postgres:** Create a database and set `DATABASE_URL` in `.env` (or `.env.local`), e.g.  
  `DATABASE_URL="postgresql://user:password@localhost:5432/contract_intelligence?schema=public"`
- **Generate client (no DB required):**  
  `pnpm prisma generate`
- **Apply migrations (requires running Postgres):**  
  `pnpm prisma migrate dev --name init`
- **Optional — partial unique index** (only one PENDING exception per contractVersion+policy): after the first migration, create a new migration and add:
  ```sql
  CREATE UNIQUE INDEX "ExceptionRequest_one_pending_per_version_policy"
  ON "ExceptionRequest" ("contractVersionId", "policyId")
  WHERE "status" = 'PENDING';
  ```

## Authentication (NextAuth / Auth.js)

- **Required env (see `.env.example` or below):**
  - `AUTH_SECRET` — secret for signing cookies/session (e.g. `openssl rand -base64 32`).  
    Also supported: `NEXTAUTH_SECRET`.
  - **Google OAuth:**  
    `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (or `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).
- **Setup:** Create a project in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), enable the Google+ API (or Google Identity), create OAuth 2.0 credentials, and set the redirect URI to `https://your-domain/api/auth/callback/google` (or `http://localhost:3000/api/auth/callback/google` for local).
- **Example `.env.local`:**
  ```bash
  DATABASE_URL="postgresql://..."
  AUTH_SECRET="your-secret-from-openssl-rand-base64-32"
  AUTH_GOOGLE_ID="your-google-client-id"
  AUTH_GOOGLE_SECRET="your-google-client-secret"
  ```
  Or with legacy names: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## STEP 3: Contracts core — manual verification checklist

After running migrations for STEP 3 schema (Counterparty type/notes/unique, Contract title/status/dates, Document fields):

1. **Counterparties**
   - Go to **Counterparties**. Create a counterparty (name, type CUSTOMER/VENDOR, optional notes). Edit and delete. Confirm duplicate name in same workspace is rejected.
2. **Contracts**
   - Go to **Contracts** → **New contract**. Select a counterparty (or create one first), set title, type, status. Create. Confirm you are redirected to contract detail and v1 exists.
   - On contract detail: add a **new version**; confirm version number increments. **Attach document metadata**: choose a file (PDF/DOCX/TXT); confirm metadata is saved with placeholder `storageKey` (e.g. `pending://...`).
   - Use **Contracts** list filters (status, type, counterparty) and open a contract from the list.
3. **RBAC**
   - As a **VIEWER** (e.g. change your membership role in DB or add a test user with VIEWER): confirm you can view contracts and counterparties but cannot create/edit/delete or add versions/documents.
4. **API**
   - `GET/POST /api/counterparties`, `PATCH/DELETE /api/counterparties/:id` (workspace-scoped, Zod-validated).
   - `GET/POST /api/contracts`, `GET/PATCH/DELETE /api/contracts/:id`, `POST /api/contracts/:id/versions`, `POST /api/contracts/:id/versions/:versionId/documents` (workspace-scoped, Zod-validated).
5. **Tests**
   - `pnpm test` — RBAC (VIEWER cannot mutate), routes, last-admin. With `DATABASE_URL` set, contract repo tests (versionNumber, workspace scoping) run as well.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
