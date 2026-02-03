import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn() };
});
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/services/risk/aggregateRisk");
vi.mock("@/core/services/reports/executiveNarrativeAI");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import { generateExecutiveNarrative, buildExecutiveNarrativeInput } from "@/core/services/reports/executiveNarrativeAI";

describe("POST /api/contracts/[id]/executive-narrative", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  const session = {
    user: { id: "u-1", email: "m@test.com", name: null, image: null },
    userId: "u-1",
    email: "m@test.com" as string | null,
    currentWorkspaceId: workspaceId,
    role: "MEMBER" as const,
  };

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue(session);
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      title: "My Contract",
      workspaceId,
      versions: [
        {
          id: versionId,
          versionNumber: 1,
          contractCompliance: [{ policyId, policy: { id: policyId, name: "Standard Policy" } }],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(aggregateRisk).mockResolvedValue({
      contractId,
      contractVersionId: versionId,
      policyId,
      overallStatus: "NEEDS_REVIEW",
      rawScore: 72,
      effectiveScore: 75,
      clusters: [],
      topDrivers: [],
      generatedAt: new Date().toISOString(),
    });
    vi.mocked(buildExecutiveNarrativeInput).mockReturnValue({
      contractTitle: "My Contract",
      policyName: "Standard Policy",
      score: 75,
      status: "NEEDS_REVIEW",
      violationCount: 1,
      unclearCount: 0,
      riskSummary: [],
      keyRisks: [],
    });
    vi.mocked(generateExecutiveNarrative).mockResolvedValue(
      "This contract presents moderate risk and requires legal review."
    );
  });

  it("returns 400 when policyId is missing", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("policyId");
  });

  it("returns 404 when contract not found", async () => {
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ policyId }) }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with narrative when versionId and policyId provided", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ policyId, versionId }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.narrative).toBe("This contract presents moderate risk and requires legal review.");
    expect(aggregateRisk).toHaveBeenCalledWith({
      contractId,
      contractVersionId: versionId,
      policyId,
    });
    expect(buildExecutiveNarrativeInput).toHaveBeenCalledWith(
      expect.anything(),
      "My Contract",
      "Standard Policy"
    );
    expect(generateExecutiveNarrative).toHaveBeenCalled();
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ policyId }) }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(403);
  });
});
