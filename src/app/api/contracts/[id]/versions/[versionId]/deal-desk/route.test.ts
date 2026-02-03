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
vi.mock("@/core/db/repositories/dealDecisionRepo");
vi.mock("@/core/db/repositories/exceptionRepo");
vi.mock("@/core/services/dealDesk/dealDecisionEngine");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";

describe("GET /api/contracts/[id]/versions/[versionId]/deal-desk", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "VIEWER",
    });
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      title: "Contract",
      counterparty: { name: "Acme" },
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
      counts: {
        violations: 0,
        criticalViolations: 0,
        unclear: 0,
        overridden: 0,
        openExceptions: 0,
        approvedExceptions: 0,
      },
      topDrivers: [],
      rationaleMarkdown: "- Effective score: **80/100**",
      riskTypeBreakdown: {},
    });
    vi.mocked(dealDecisionRepo.findDealDecisionByVersionAndPolicy).mockResolvedValue(null);
    vi.mocked(exceptionRepo.findManyExceptionRequestsByContractVersion).mockResolvedValue([]);
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const req = new Request(
      `http://x/api/contracts/${contractId}/versions/${versionId}/deal-desk?policyId=${policyId}`
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when policyId missing", async () => {
    const req = new Request(`http://x/api/contracts/${contractId}/versions/${versionId}/deal-desk`);
    const res = await GET(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 MISSING_ANALYSIS when no compliance for version+policy", async () => {
    vi.mocked(computeDealDecisionPreview).mockResolvedValue(null);
    const req = new Request(
      `http://x/api/contracts/${contractId}/versions/${versionId}/deal-desk?policyId=${policyId}`
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("MISSING_ANALYSIS");
  });

  it("returns 200 with preview, decision, exceptionsSummary when analysis exists", async () => {
    const req = new Request(
      `http://x/api/contracts/${contractId}/versions/${versionId}/deal-desk?policyId=${policyId}`
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview).toBeDefined();
    expect(json.preview.outcome).toBe("GO");
    expect(json.preview.effectiveScore).toBe(80);
    expect(json.decision).toBeNull();
    expect(json.exceptionsSummary).toBeDefined();
    expect(json.exceptionsSummary.openCount).toBe(0);
    expect(json.contract).toBeDefined();
    expect(json.version).toBeDefined();
  });
});
