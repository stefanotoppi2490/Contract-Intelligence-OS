import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn() };
});
vi.mock("@/core/db/repositories/dashboardRepo");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { getDashboardContractRows } from "@/core/db/repositories/dashboardRepo";

const viewerSession = {
  user: { id: "u-1", email: "v@test.com", name: null, image: null },
  userId: "u-1",
  email: "v@test.com" as string | null,
  currentWorkspaceId: "ws-1",
  role: "VIEWER" as const,
};

describe("GET /api/dashboard/contracts", () => {
  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue(viewerSession);
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(getDashboardContractRows).mockResolvedValue({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
      policyId: "p-1",
      policyName: "Default Policy",
    });
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET(new Request("http://x/api/dashboard/contracts"));
    expect(res.status).toBe(403);
    expect(vi.mocked(getDashboardContractRows)).not.toHaveBeenCalled();
  });

  it("returns 200 with dashboard result for VIEWER", async () => {
    vi.mocked(getDashboardContractRows).mockResolvedValue({
      rows: [
        {
          contractId: "c-1",
          contractTitle: "Test Contract",
          counterpartyId: "cp-1",
          counterpartyName: "Acme",
          versionId: "v-1",
          versionNumber: 1,
          effectiveScore: 85,
          status: "COMPLIANT",
          violationCount: 0,
          unclearCount: 0,
          overriddenCount: 0,
          riskTypeBreakdown: {},
          exceptionsRequested: 0,
          exceptionsApproved: 0,
          lastAnalyzedAt: "2025-02-01T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      policyId: "p-1",
      policyName: "Default Policy",
    });
    const res = await GET(new Request("http://x/api/dashboard/contracts"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0].contractTitle).toBe("Test Contract");
    expect(json.rows[0].effectiveScore).toBe(85);
    expect(json.policyId).toBe("p-1");
    expect(vi.mocked(getDashboardContractRows)).toHaveBeenCalledWith("ws-1", expect.any(Object));
  });

  it("passes riskType filter to repo", async () => {
    await GET(
      new Request("http://x/api/dashboard/contracts?riskType=LEGAL")
    );
    expect(vi.mocked(getDashboardContractRows)).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ riskType: "LEGAL" })
    );
  });

  it("passes status and policyId to repo", async () => {
    await GET(
      new Request("http://x/api/dashboard/contracts?policyId=p-2&status=NEEDS_REVIEW")
    );
    expect(vi.mocked(getDashboardContractRows)).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ policyId: "p-2", status: "NEEDS_REVIEW" })
    );
  });

  it("returns 400 for invalid query", async () => {
    const res = await GET(
      new Request("http://x/api/dashboard/contracts?status=INVALID")
    );
    expect(res.status).toBe(400);
  });
});
