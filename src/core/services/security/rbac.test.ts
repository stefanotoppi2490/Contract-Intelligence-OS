import { describe, it, expect } from "vitest";
import {
  ROLE_PRECEDENCE,
  roleRank,
  hasMinRole,
  isAllowedRole,
  requireAuth,
  requireWorkspace,
  requireRole,
  AuthError,
} from "./rbac";
import type { AppSession } from "./auth";
import type { MemberRole } from "@prisma/client";

describe("RBAC role precedence", () => {
  it("defines OWNER as highest rank", () => {
    expect(roleRank("OWNER")).toBe(0);
  });

  it("defines VIEWER as lowest rank", () => {
    expect(roleRank("VIEWER")).toBe(ROLE_PRECEDENCE.length - 1);
  });

  it("orders roles: OWNER > ADMIN > LEGAL > RISK > MEMBER > VIEWER", () => {
    const order: MemberRole[] = ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER", "VIEWER"];
    for (let i = 0; i < order.length; i++) {
      expect(roleRank(order[i]!)).toBe(i);
    }
  });

  it("hasMinRole: same role satisfies", () => {
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinRole("VIEWER", "VIEWER")).toBe(true);
  });

  it("hasMinRole: higher role satisfies minRole", () => {
    expect(hasMinRole("OWNER", "ADMIN")).toBe(true);
    expect(hasMinRole("ADMIN", "MEMBER")).toBe(true);
    expect(hasMinRole("LEGAL", "VIEWER")).toBe(true);
  });

  it("hasMinRole: lower role does not satisfy minRole", () => {
    expect(hasMinRole("MEMBER", "ADMIN")).toBe(false);
    expect(hasMinRole("VIEWER", "LEGAL")).toBe(false);
    expect(hasMinRole("ADMIN", "OWNER")).toBe(false);
  });

  it("isAllowedRole: returns true only for listed roles", () => {
    expect(isAllowedRole("ADMIN", ["ADMIN", "LEGAL"])).toBe(true);
    expect(isAllowedRole("LEGAL", ["ADMIN", "LEGAL"])).toBe(true);
    expect(isAllowedRole("MEMBER", ["ADMIN", "LEGAL"])).toBe(false);
  });
});

describe("RBAC guards", () => {
  const sessionWithWorkspace: AppSession = {
    user: { id: "u1", email: "a@b.com", name: null, image: null },
    userId: "u1",
    email: "a@b.com",
    currentWorkspaceId: "w1",
    role: "ADMIN",
  };

  it("requireAuth throws when session is null", () => {
    expect(() => requireAuth(null)).toThrow(AuthError);
    expect(() => requireAuth(null)).toThrow("Unauthorized");
  });

  it("requireAuth does not throw when session has userId", () => {
    expect(() => requireAuth(sessionWithWorkspace)).not.toThrow();
  });

  it("requireWorkspace throws when no workspace selected", () => {
    const noWorkspace: AppSession = { ...sessionWithWorkspace, currentWorkspaceId: null, role: null };
    expect(() => requireWorkspace(noWorkspace)).toThrow(AuthError);
    expect(() => requireWorkspace(noWorkspace)).toThrow("No workspace selected");
  });

  it("requireWorkspace does not throw when workspace and role set", () => {
    expect(() => requireWorkspace(sessionWithWorkspace)).not.toThrow();
  });

  it("requireRole(minRole) throws when role is below minRole", () => {
    const memberSession: AppSession = { ...sessionWithWorkspace, role: "MEMBER" };
    expect(() => requireRole(memberSession, { minRole: "ADMIN" })).toThrow(AuthError);
    expect(() => requireRole(memberSession, { minRole: "ADMIN" })).toThrow("Insufficient role");
  });

  it("requireRole(minRole) does not throw when role meets minRole", () => {
    expect(() => requireRole(sessionWithWorkspace, { minRole: "ADMIN" })).not.toThrow();
    expect(() => requireRole(sessionWithWorkspace, { minRole: "VIEWER" })).not.toThrow();
  });

  it("requireRole(allowedRoles) throws when role not in list", () => {
    const memberSession: AppSession = { ...sessionWithWorkspace, role: "MEMBER" };
    expect(() => requireRole(memberSession, { allowedRoles: ["ADMIN", "LEGAL"] })).toThrow(
      "Insufficient role"
    );
  });

  it("requireRole(allowedRoles) does not throw when role in list", () => {
    expect(() =>
      requireRole(sessionWithWorkspace, { allowedRoles: ["ADMIN", "LEGAL"] })
    ).not.toThrow();
  });
});
