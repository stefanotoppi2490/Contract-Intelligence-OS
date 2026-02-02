import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn(), requireRole: vi.fn() };
});
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/services/policyEngine/defaultPolicyRules", () => ({
  seedDefaultPolicyRules: vi.fn(() => Promise.resolve(7)),
}));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { seedDefaultPolicyRules } from "@/core/services/policyEngine/defaultPolicyRules";

describe("GET /api/policies", () => {
  const workspaceId = "ws-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "MEMBER",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(policyRepo.findManyPoliciesByWorkspace).mockResolvedValue([
      {
        id: "p-1",
        name: "Standard",
        description: null,
        isActive: true,
        rules: [
          {
            id: "r-1",
            clauseType: "TERMINATION",
            ruleType: "REQUIRED",
            expectedValue: null,
            severity: "MEDIUM",
            riskType: "LEGAL",
            weight: 5,
            recommendation: "Ensure notice periods.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ] as Awaited<ReturnType<typeof policyRepo.findManyPoliciesByWorkspace>>);
  });

  it("returns policies with rules", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe("Standard");
    expect(json[0].rules).toHaveLength(1);
    expect(json[0].rules[0].clauseType).toBe("TERMINATION");
    expect(json[0].rules[0].recommendation).toBe("Ensure notice periods.");
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("POST /api/policies", () => {
  const workspaceId = "ws-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "ADMIN",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(policyRepo.createPolicy).mockResolvedValue({
      id: "p-new",
      name: "New Policy",
      description: null,
      isActive: true,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof policyRepo.createPolicy>>);
  });

  it("creates policy with seedDefaults=true and seeds rules", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Policy", seedDefaults: true }),
      })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(seedDefaultPolicyRules)).toHaveBeenCalledWith("p-new");
    const json = await res.json();
    expect(json.rulesCount).toBe(7);
  });

  it("creates policy without rules when seedDefaults=false", async () => {
    vi.mocked(seedDefaultPolicyRules).mockClear();
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Empty Policy", seedDefaults: false }),
      })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(seedDefaultPolicyRules)).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.rulesCount).toBe(0);
  });

  it("returns 403 when VIEWER", async () => {
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when name missing", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });
});
