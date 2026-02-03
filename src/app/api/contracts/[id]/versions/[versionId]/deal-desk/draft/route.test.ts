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

describe("POST /api/contracts/[id]/versions/[versionId]/deal-desk/draft", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

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
    vi.mocked(computeDealDecisionPreview).mockResolvedValue({
      contractId,
      contractVersionId: versionId,
      policyId,
      effectiveScore: 80,
      rawScore: 80,
      outcome: "GO",
      statusSuggestion: "DRAFT",
      counts: { violations: 0, criticalViolations: 0, unclear: 0, overridden: 0, openExceptions: 0, approvedExceptions: 0 },
      topDrivers: [],
      rationaleMarkdown: "- Effective score: **80/100**",
      riskTypeBreakdown: {},
    });
    vi.mocked(dealDecisionRepo.upsertDealDecisionDraft).mockResolvedValue({
      id: "dd-1",
      status: "DRAFT",
      outcome: "GO",
      rationale: "- Effective score: **80/100**",
      executiveSummary: null,
    } as Awaited<ReturnType<typeof dealDecisionRepo.upsertDealDecisionDraft>>);
  });

  it("returns 403 when VIEWER (requireRole throws)", async () => {
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

  it("returns 200 and creates/updates draft when LEGAL", async () => {
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
    expect(json.id).toBe("dd-1");
    expect(json.status).toBe("DRAFT");
    expect(json.outcome).toBe("GO");
  });
});
