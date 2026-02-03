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
vi.mock("@/core/services/dealDesk/dealDecisionEngine");
vi.mock("@/core/services/ledger/ledgerService");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";

describe("POST /api/contracts/[id]/versions/[versionId]/deal-desk/finalize", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  const preview = {
    contractId,
    contractVersionId: versionId,
    policyId,
    effectiveScore: 80,
    rawScore: 80,
    outcome: "GO" as const,
    statusSuggestion: "DRAFT" as const,
    counts: { violations: 0, criticalViolations: 0, unclear: 0, overridden: 0, openExceptions: 0, approvedExceptions: 0 },
    topDrivers: [],
    rationaleMarkdown: "- Effective score: **80/100**",
    riskTypeBreakdown: {},
  };

  const finalizedDecision = {
    id: "dd-1",
    status: "FINAL" as const,
    outcome: "GO" as const,
    finalizedAt: new Date(),
    rationale: preview.rationaleMarkdown,
    executiveSummary: null,
    finalizedByUserId: "u-1",
    policy: { name: "Policy" },
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
      versions: [{ id: versionId, versionNumber: 1 }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(computeDealDecisionPreview).mockResolvedValue(preview);
    vi.mocked(dealDecisionRepo.findDealDecisionByVersionAndPolicy).mockResolvedValue(null);
    vi.mocked(dealDecisionRepo.createDealDecision).mockResolvedValue(finalizedDecision as Awaited<ReturnType<typeof dealDecisionRepo.createDealDecision>>);
    vi.mocked(dealDecisionRepo.findDealDecisionByVersionAndPolicy).mockResolvedValue(finalizedDecision as Awaited<ReturnType<typeof dealDecisionRepo.findDealDecisionByVersionAndPolicy>>);
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

  it("finalize is idempotent: when decision already FINAL, returns existing without calling finalize again", async () => {
    const existingFinal = {
      ...finalizedDecision,
      id: "dd-1",
      status: "FINAL" as const,
      finalizedAt: new Date(),
    };
    vi.mocked(dealDecisionRepo.findDealDecisionByVersionAndPolicy).mockResolvedValue(
      existingFinal as Awaited<ReturnType<typeof dealDecisionRepo.findDealDecisionByVersionAndPolicy>>
    );

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
    expect(json.status).toBe("FINAL");
    expect(json.id).toBe("dd-1");
    expect(dealDecisionRepo.finalizeDealDecision).not.toHaveBeenCalled();
    expect(dealDecisionRepo.createDealDecision).not.toHaveBeenCalled();
  });
});
