/**
 * NextAuth (Auth.js) v5 config — Prisma adapter, Google OAuth.
 * Session includes userId, email, currentWorkspaceId (from cookie), role (from membership).
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/core/db/prisma";
import type { MemberRole } from "@prisma/client";

const CURRENT_WORKSPACE_COOKIE = "current_workspace_id";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

export type AppSession = {
  user: SessionUser;
  userId: string;
  email: string | null;
  currentWorkspaceId: string | null;
  role: MemberRole | null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  trustHost: true,
});

/**
 * Cookie name for current workspace (used server-side).
 */
export function getCurrentWorkspaceCookieName(): string {
  return CURRENT_WORKSPACE_COOKIE;
}

/**
 * Load session with current workspace and role (server-side).
 * Call from Server Components, Route Handlers, or Server Actions.
 * Validates that current_workspace_id cookie belongs to the user's membership.
 */
export async function getServerSessionWithWorkspace(): Promise<AppSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(CURRENT_WORKSPACE_COOKIE)?.value ?? null;

  const userId = session.user.id;
  const user: SessionUser = {
    id: userId,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };

  if (!workspaceId) {
    return {
      user,
      userId,
      email: session.user.email ?? null,
      currentWorkspaceId: null,
      role: null,
    };
  }

  const { findMembershipByWorkspaceAndUser } = await import("@/core/db/repositories/membershipRepo");
  const membership = await findMembershipByWorkspaceAndUser(workspaceId, userId);
  if (!membership) {
    return {
      user,
      userId,
      email: session.user.email ?? null,
      currentWorkspaceId: null,
      role: null,
    };
  }

  return {
    user,
    userId,
    email: session.user.email ?? null,
    currentWorkspaceId: workspaceId,
    role: membership.role,
  };
}
