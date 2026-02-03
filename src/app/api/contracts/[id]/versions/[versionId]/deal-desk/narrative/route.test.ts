import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn(), requireRole: vi.fn() };
});
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/db/repositories/dealDecisionRepo");
vi.mock("@/core/services/risk/aggregateRisk");
vi.mock("@/core/services/reports/executiveNarrativeAI");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import * as aggregateRisk from "@/core/services/risk/aggregateRisk";
import * as executiveNarrativeAI from "@/core/services/reports/executiveNarrativeAI";

describe("POST /api/contracts/[id]/versions/[versionId]/deal-desk/narrative", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  const minimalAggregation = {
    overallStatus: "NEEDS_REVIEW" as const,
    rawScore: 72,
    effectiveScore: 75,
    clusters: [
      { riskType: "LEGAL", level: "MEDIUM", violationCount: 1, unclearCount: 0, totalWeight: 5, maxSeverity: "HIGH", topDrivers: [] },
      { riskType: "DATA", level: "OK", violationCount: 0, unclearCount: 1, totalWeight: 0, maxSeverity: null, topDrivers: [] },
    ],
    topDrivers: [{ clauseType: "LIABILITY", severity: "HIGH", weight: 5, reason: "Cap below policy" }],
    generatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "LEGAL",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      title: "MSA",
      counterparty: { name: "Acme" },
      versions: [
        {
          id: versionId,
          versionNumber: 1,
          contractCompliance: [{ policyId, policy: { name: "Policy" } }],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(aggregateRisk.aggregateRisk).mockResolvedValue(minimalAggregation as Awaited<ReturnType<typeof aggregateRisk.aggregateRisk>>);
    vi.mocked(executiveNarrativeAI.buildExecutiveNarrativeInput).mockReturnValue({
      contractTitle: "MSA",
      policyName: "Policy",
      score: 75,
      status: "NEEDS_REVIEW",
      violationCount: 1,
      unclearCount: 1,
      riskSummary: [],
      keyRisks: ["Liability cap below policy"],
    });
    vi.mocked(executiveNarrativeAI.generateExecutiveNarrative).mockResolvedValue("Generated narrative from structured data.");
    vi.mocked(dealDecisionRepo.findDealDecisionByVersionAndPolicy).mockResolvedValue(null);
  });

  it("returns 403 when VIEWER", async () => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "VIEWER",
    });
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(403);
  });

  it("calls buildExecutiveNarrativeInput and generateExecutiveNarrative with structured data only (no raw contract text)", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(executiveNarrativeAI.buildExecutiveNarrativeInput).toHaveBeenCalledWith(
      minimalAggregation,
      "MSA",
      "Policy"
    );
    const input = vi.mocked(executiveNarrativeAI.buildExecutiveNarrativeInput).mock.results[0]?.value;
    expect(input).toBeDefined();
    expect(input).toHaveProperty("contractTitle");
    expect(input).toHaveProperty("policyName");
    expect(input).toHaveProperty("score");
    expect(input).toHaveProperty("riskSummary");
    expect(input).toHaveProperty("keyRisks");
    expect(input).not.toHaveProperty("fullText");
    expect(input).not.toHaveProperty("contractText");
    expect(input).not.toHaveProperty("rawText");
    expect(executiveNarrativeAI.generateExecutiveNarrative).toHaveBeenCalled();
  });

  it("returns 200 with narrative", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.narrative).toBe("Generated narrative from structured data.");
  });
});
