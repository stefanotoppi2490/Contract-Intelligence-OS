import { describe, it, expect } from "vitest";
import { requireRole, hasMinRole } from "./rbac";
import type { AppSession } from "./auth";
import { AuthError } from "./rbac";

describe("VIEWER cannot mutate", () => {
  const sessionViewer: AppSession = {
    user: { id: "u1", email: "v@test.com", name: null, image: null },
    userId: "u1",
    email: "v@test.com",
    currentWorkspaceId: "w1",
    role: "VIEWER",
  };

  const sessionMember: AppSession = {
    ...sessionViewer,
    role: "MEMBER",
  };

  it("requireRole with minRole MEMBER throws for VIEWER", () => {
    expect(() => requireRole(sessionViewer, { minRole: "MEMBER" })).toThrow(AuthError);
    expect(() => requireRole(sessionViewer, { minRole: "MEMBER" })).toThrow("Insufficient role");
  });

  it("requireRole with allowedRoles [ADMIN, MEMBER] throws for VIEWER", () => {
    expect(() =>
      requireRole(sessionViewer, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] })
    ).toThrow(AuthError);
    expect(() =>
      requireRole(sessionViewer, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] })
    ).toThrow("Insufficient role");
  });

  it("requireRole with minRole MEMBER does not throw for MEMBER", () => {
    expect(() => requireRole(sessionMember, { minRole: "MEMBER" })).not.toThrow();
  });

  it("hasMinRole(VIEWER, MEMBER) is false so VIEWER cannot mutate", () => {
    expect(hasMinRole("VIEWER", "MEMBER")).toBe(false);
  });

  it("hasMinRole(MEMBER, MEMBER) is true so MEMBER can mutate", () => {
    expect(hasMinRole("MEMBER", "MEMBER")).toBe(true);
  });
});
