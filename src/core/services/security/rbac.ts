/**
 * RBAC: role precedence and guard helpers.
 * Precedence (highest first): OWNER > ADMIN > LEGAL > RISK > MEMBER > VIEWER.
 */

import type { MemberRole } from "@prisma/client";
import type { AppSession } from "./auth";

/** Role precedence order (index = rank; lower index = higher privilege). */
export const ROLE_PRECEDENCE: MemberRole[] = [
  "OWNER",
  "ADMIN",
  "LEGAL",
  "RISK",
  "MEMBER",
  "VIEWER",
];

/** Allowed roles for RBAC (ADMIN, LEGAL, RISK, MEMBER, VIEWER per spec; OWNER treated as ADMIN). */
export const RBAC_ROLES: MemberRole[] = ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER", "VIEWER"];

export function roleRank(role: MemberRole): number {
  const i = ROLE_PRECEDENCE.indexOf(role);
  return i === -1 ? ROLE_PRECEDENCE.length : i;
}

/** True if `role` has at least the privilege of `minRole`. */
export function hasMinRole(role: MemberRole, minRole: MemberRole): boolean {
  return roleRank(role) <= roleRank(minRole);
}

/** True if `role` is in `allowedRoles`. */
export function isAllowedRole(role: MemberRole, allowedRoles: MemberRole[]): boolean {
  return allowedRoles.includes(role);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Require a valid session. Throws AuthError if not signed in.
 */
export function requireAuth(session: AppSession | null): asserts session is AppSession {
  if (!session?.userId) {
    throw new AuthError("Unauthorized", 401);
  }
}

/**
 * Require session with a selected workspace. Throws AuthError if no workspace.
 */
export function requireWorkspace(session: AppSession | null): asserts session is AppSession {
  requireAuth(session);
  if (!session.currentWorkspaceId || !session.role) {
    throw new AuthError("No workspace selected", 403);
  }
}

export type RequireRoleOptions =
  | { minRole: MemberRole }
  | { allowedRoles: MemberRole[] };

/**
 * Require session with workspace and role meeting minRole or allowedRoles.
 */
export function requireRole(
  session: AppSession | null,
  options: RequireRoleOptions
): asserts session is AppSession {
  requireWorkspace(session);
  const role = session.role!;
  if ("minRole" in options) {
    if (!hasMinRole(role, options.minRole)) {
      throw new AuthError("Insufficient role", 403);
    }
  } else {
    if (!isAllowedRole(role, options.allowedRoles)) {
      throw new AuthError("Insufficient role", 403);
    }
  }
}
