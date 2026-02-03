import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn() };
});
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/services/risk/aggregateRisk");
vi.mock("@/core/services/risk/executiveSummary", () => ({
  buildExecutiveSummary: vi.fn((agg: { overallStatus: string }) => ({
    headline:
      agg.overallStatus === "COMPLIANT"
        ? "Contract compliant with company standards."
        : agg.overallStatus === "NEEDS_REVIEW"
          ? "Contract requires review before approval."
          : "Contract is not compliant with company standards.",
    paragraphs: [`Overall status: ${agg.overallStatus}.`],
    keyRisks: [],
    recommendation: "Legal or risk review recommended.",
  })),
}));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";

describe("GET /api/contracts/[id]/versions/[versionId]/risk-summary", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "MEMBER",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      versions: [{ id: versionId }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(aggregateRisk).mockResolvedValue({
      contractId,
      contractVersionId: versionId,
      policyId,
      overallStatus: "NEEDS_REVIEW",
      rawScore: 80,
      effectiveScore: 85,
      clusters: [],
      topDrivers: [],
      generatedAt: new Date().toISOString(),
    });
  });

  it("returns 400 when policyId is missing", async () => {
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("policyId");
  });

  it("returns 404 when contract not found", async () => {
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue(null);
    const res = await GET(
      new Request(`http://x?policyId=${policyId}`),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when aggregation is null (no compliance)", async () => {
    vi.mocked(aggregateRisk).mockResolvedValue(null);
    const res = await GET(
      new Request(`http://x?policyId=${policyId}`),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("compliance");
  });

  it("returns 200 with aggregation and summary when workspace-scoped contract and policyId provided", async () => {
    const res = await GET(
      new Request(`http://x?policyId=${policyId}`),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.aggregation).toBeDefined();
    expect(json.aggregation.contractId).toBe(contractId);
    expect(json.aggregation.policyId).toBe(policyId);
    expect(json.aggregation.effectiveScore).toBe(85);
    expect(json.summary).toBeDefined();
    expect(json.summary.headline).toBeDefined();
    expect(json.summary.recommendation).toBeDefined();
    expect(vi.mocked(contractRepo.getContractDetail)).toHaveBeenCalledWith(contractId, workspaceId);
    expect(vi.mocked(aggregateRisk)).toHaveBeenCalledWith({
      contractId,
      contractVersionId: versionId,
      policyId,
    });
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET(
      new Request(`http://x?policyId=${policyId}`),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(403);
  });
});
