import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn(), requireRole: vi.fn() };
});
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/policyRuleRepo");
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";

describe("POST /api/policies/[policyId]/rules", () => {
  const workspaceId = "ws-1";
  const policyId = "p-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "LEGAL",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue({
      id: policyId,
      workspaceId,
      name: "Test",
      description: null,
      isActive: true,
      rules: [],
    } as Awaited<ReturnType<typeof policyRepo.findPolicyByWorkspaceAndId>>);
    vi.mocked(policyRuleRepo.createPolicyRule).mockResolvedValue({
      id: "r-1",
      policyId,
      clauseType: "TERMINATION",
      ruleType: "REQUIRED",
      expectedValue: null,
      severity: "MEDIUM",
      riskType: "LEGAL",
      weight: 5,
      recommendation: "Ensure notice periods.",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof policyRuleRepo.createPolicyRule>>);
  });

  it("creates rule when body valid", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: "TERMINATION",
          ruleType: "REQUIRED",
          severity: "MEDIUM",
          riskType: "LEGAL",
          weight: 5,
          recommendation: "Ensure notice periods.",
        }),
      }),
      { params: Promise.resolve({ policyId }) }
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(policyRuleRepo.createPolicyRule)).toHaveBeenCalledWith(
      expect.objectContaining({
        clauseType: "TERMINATION",
        ruleType: "REQUIRED",
        recommendation: "Ensure notice periods.",
      })
    );
    const json = await res.json();
    expect(json.id).toBe("r-1");
    expect(json.recommendation).toBe("Ensure notice periods.");
  });

  it("returns 404 when policy not in workspace", async () => {
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: "TERMINATION",
          ruleType: "REQUIRED",
          recommendation: "X",
        }),
      }),
      { params: Promise.resolve({ policyId }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when VIEWER", async () => {
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: "TERMINATION",
          ruleType: "REQUIRED",
          recommendation: "X",
        }),
      }),
      { params: Promise.resolve({ policyId }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when recommendation missing", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: "TERMINATION",
          ruleType: "REQUIRED",
        }),
      }),
      { params: Promise.resolve({ policyId }) }
    );
    expect(res.status).toBe(400);
  });
});
