import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn(), requireRole: vi.fn() };
});
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/policyRuleRepo");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";

describe("PATCH /api/policies/[policyId]/rules/[ruleId]", () => {
  const workspaceId = "ws-1";
  const policyId = "p-1";
  const ruleId = "r-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "ADMIN",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue({
      id: policyId,
      workspaceId,
      name: "Test",
      rules: [],
    } as Awaited<ReturnType<typeof policyRepo.findPolicyByWorkspaceAndId>>);
    vi.mocked(policyRuleRepo.findPolicyRuleById).mockResolvedValue({
      id: ruleId,
      policyId,
      clauseType: "TERMINATION",
      ruleType: "REQUIRED",
      recommendation: "Old",
      weight: 5,
    } as Awaited<ReturnType<typeof policyRuleRepo.findPolicyRuleById>>);
    vi.mocked(policyRuleRepo.updatePolicyRule).mockResolvedValue({
      id: ruleId,
      policyId,
      clauseType: "LIABILITY",
      ruleType: "REQUIRED",
      recommendation: "Updated recommendation",
      weight: 10,
      severity: "HIGH",
      riskType: "LEGAL",
      expectedValue: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof policyRuleRepo.updatePolicyRule>>);
  });

  it("updates rule", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: "LIABILITY",
          weight: 10,
          recommendation: "Updated recommendation",
        }),
      }),
      { params: Promise.resolve({ policyId, ruleId }) }
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(policyRuleRepo.updatePolicyRule)).toHaveBeenCalledWith(
      ruleId,
      expect.objectContaining({
        clauseType: "LIABILITY",
        weight: 10,
        recommendation: "Updated recommendation",
      })
    );
    const json = await res.json();
    expect(json.recommendation).toBe("Updated recommendation");
  });

  it("returns 404 when rule not in policy", async () => {
    vi.mocked(policyRuleRepo.findPolicyRuleById).mockResolvedValue({
      id: ruleId,
      policyId: "other-policy",
    } as Awaited<ReturnType<typeof policyRuleRepo.findPolicyRuleById>>);
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation: "X" }),
      }),
      { params: Promise.resolve({ policyId, ruleId }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when VIEWER", async () => {
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation: "X" }),
      }),
      { params: Promise.resolve({ policyId, ruleId }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/policies/[policyId]/rules/[ruleId]", () => {
  const workspaceId = "ws-1";
  const policyId = "p-1";
  const ruleId = "r-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "RISK",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue({
      id: policyId,
      workspaceId,
    } as Awaited<ReturnType<typeof policyRepo.findPolicyByWorkspaceAndId>>);
    vi.mocked(policyRuleRepo.findPolicyRuleById).mockResolvedValue({
      id: ruleId,
      policyId,
    } as Awaited<ReturnType<typeof policyRuleRepo.findPolicyRuleById>>);
    vi.mocked(policyRuleRepo.deletePolicyRule).mockResolvedValue({} as never);
  });

  it("deletes rule", async () => {
    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ policyId, ruleId }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(policyRuleRepo.deletePolicyRule)).toHaveBeenCalledWith(ruleId);
    const json = await res.json();
    expect(json.deleted).toBe(true);
    expect(json.id).toBe(ruleId);
  });

  it("returns 404 when policy not in workspace", async () => {
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue(null);
    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ policyId, ruleId }),
    });
    expect(res.status).toBe(404);
  });
});
