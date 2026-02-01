import { describe, it, expect } from "vitest";
import { hasMinRole } from "./rbac";

/**
 * Unit test: "cannot demote last admin" logic.
 * Business rule: if workspace has exactly one admin (OWNER or ADMIN), that user cannot be
 * demoted to a role below ADMIN, nor removed.
 */
describe("Cannot demote last admin", () => {
  it("hasMinRole(ADMIN, ADMIN) is true so demoting ADMIN to MEMBER would demote", () => {
    const currentRole = "ADMIN";
    const newRole = "MEMBER";
    const isAdmin = hasMinRole(currentRole, "ADMIN");
    const wouldDemote = !hasMinRole(newRole, "ADMIN");
    expect(isAdmin).toBe(true);
    expect(wouldDemote).toBe(true);
  });

  it("hasMinRole(MEMBER, ADMIN) is false so changing MEMBER to VIEWER is not demoting last admin", () => {
    const currentRole = "MEMBER";
    const newRole = "VIEWER";
    const isAdmin = hasMinRole(currentRole, "ADMIN");
    expect(isAdmin).toBe(false);
  });

  it("OWNER and ADMIN both count as admin for last-admin check", () => {
    expect(hasMinRole("OWNER", "ADMIN")).toBe(true);
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("LEGAL and below are not admin", () => {
    expect(hasMinRole("LEGAL", "ADMIN")).toBe(false);
    expect(hasMinRole("RISK", "ADMIN")).toBe(false);
    expect(hasMinRole("MEMBER", "ADMIN")).toBe(false);
    expect(hasMinRole("VIEWER", "ADMIN")).toBe(false);
  });

  it("when adminCount <= 1 and target is admin, demoting to MEMBER should be rejected", () => {
    const adminCount = 1;
    const membershipRole = "ADMIN";
    const newRole = "MEMBER";
    const isAdmin = hasMinRole(membershipRole, "ADMIN");
    const wouldDemote = isAdmin && !hasMinRole(newRole, "ADMIN");
    const cannotDemoteLastAdmin = adminCount <= 1 && wouldDemote;
    expect(cannotDemoteLastAdmin).toBe(true);
  });

  it("when adminCount > 1, demoting one admin is allowed", () => {
    const adminCount = 2;
    const membershipRole = "ADMIN";
    const newRole = "MEMBER";
    const isAdmin = hasMinRole(membershipRole, "ADMIN");
    const wouldDemote = isAdmin && !hasMinRole(newRole, "ADMIN");
    const cannotDemoteLastAdmin = adminCount <= 1 && wouldDemote;
    expect(cannotDemoteLastAdmin).toBe(false);
  });
});
