Implement STEP 2: Authentication + Workspace + RBAC foundation (NextAuth) for Contract Intelligence OS.

Context:

- Prisma schema v1 is already implemented with: Workspace, User, Membership (role), AuditEvent.
- Next.js App Router + TS strict.
- Must be deployable on Vercel.

Requirements:

1. NextAuth (Auth.js) setup:
   - Use Prisma adapter (Auth.js Prisma Adapter).
   - Provider: Email magic link OR Google OAuth (choose Google OAuth by default; keep it easy).
   - Persist users into Prisma User model.
   - Ensure session includes: userId, email, currentWorkspaceId (selected workspace), and role in that workspace.
   - Add a utility to load session server-side (no client hacks).

2. Workspace onboarding & selection:
   - If user has no memberships: force onboarding page to create first Workspace.
   - Create workspace: name required, create membership role=ADMIN for creator.
   - If user has memberships: show workspace selector.
   - Store currentWorkspaceId in a signed cookie (server-side) OR user preference table (prefer cookie for MVP).
   - Every app route under /(app) requires auth + current workspace selected.

3. RBAC:
   - Implement RBAC guard helpers:
     - requireAuth()
     - requireWorkspace()
     - requireRole(minRole or allowedRoles)
   - Roles: ADMIN, LEGAL, RISK, MEMBER, VIEWER
   - Provide a deterministic role precedence order.

4. Audit:
   - When workspace is created, membership created, workspace selected: write AuditEvent.
   - AuditEvent must be append-only, with actorUserId, workspaceId, eventType, payload Json.

5. UI:
   - Create app layout shell under /app/(app)/layout.tsx with nav:
     - Contracts
     - Policies
     - Exceptions
     - Ledger
     - Settings (Members)
   - Create pages:
     - /app/(auth)/signin
     - /app/(app)/onboarding (create workspace)
     - /app/(app)/select-workspace
     - /app/(app)/settings/members (list members, only ADMIN can access)

6. Members management (MVP):
   - ADMIN can invite/add members by email:
     - If user exists: create membership
     - If not: create a pending invitation record as placeholder in payload (if Invitation model doesn't exist yet, store as AuditEvent only and show UI message "invitation sent"; do not invent new tables unless necessary).
   - ADMIN can change member role (except cannot demote last ADMIN).
   - ADMIN can remove member (except cannot remove last ADMIN).

7. API routes:
   - Use Next.js Route Handlers.
   - Implement:
     - POST /api/workspaces (create)
     - GET /api/workspaces (list mine)
     - POST /api/workspaces/select (set current workspace)
     - GET /api/members (list members in current workspace)
     - POST /api/members (add member)
     - PATCH /api/members/:id (change role)
     - DELETE /api/members/:id (remove)

8. Validation & quality:
   - Validate every request with Zod.
   - Never access Prisma directly in route handlers; use repositories.
   - Implement minimal tests:
     - unit test RBAC role precedence
     - unit test "cannot demote last admin"

Deliverables:

- NextAuth config in /app/api/auth/[...nextauth]/route.ts (or Auth.js equivalent for App Router)
- src/core/services/security/auth.ts + rbac.ts
- API routes + Zod schemas
- UI pages/components (shadcn)
- Tests (vitest or jest; pick one and wire minimal config)
- README snippet: how to set GOOGLE_CLIENT_ID/SECRET and NEXTAUTH_SECRET.
