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
vi.mock("@/core/db/repositories/workspaceRepo");
vi.mock("@/core/db/repositories/exceptionRepo");
vi.mock("@/core/services/dealDesk/dealDecisionEngine");
vi.mock("@/core/services/reports/dealDeskReport");
vi.mock("@/core/services/ledger/ledgerService");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";
import { buildDealDeskHtml, buildDealDeskPdf } from "@/core/services/reports/dealDeskReport";

describe("POST /api/contracts/[id]/versions/[versionId]/deal-desk/report", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  const preview = {
    contractId,
    contractVersionId: versionId,
    policyId,
    effectiveScore: 72,
    rawScore: 68,
    outcome: "NEEDS_REVIEW",
    statusSuggestion: "DRAFT",
    counts: { violations: 1, criticalViolations: 0, unclear: 0, overridden: 0, openExceptions: 0, approvedExceptions: 0 },
    topDrivers: [],
    rationaleMarkdown: "- Effective score: **72/100**",
    riskTypeBreakdown: { LEGAL: { violations: 1, unclear: 0 } },
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
      versions: [{ id: versionId, versionNumber: 1 }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(computeDealDecisionPreview).mockResolvedValue(preview);
    vi.mocked(dealDecisionRepo.findDealDecisionByVersionAndPolicy).mockResolvedValue(null);
    vi.mocked(workspaceRepo.findWorkspaceById).mockResolvedValue({ id: workspaceId, name: "Workspace" } as Awaited<ReturnType<typeof workspaceRepo.findWorkspaceById>>);
    vi.mocked(exceptionRepo.findManyExceptionRequestsByContractVersion).mockResolvedValue([]);
    vi.mocked(buildDealDeskHtml).mockReturnValue("<html><body>Deal Desk Report</body></html>");
    vi.mocked(buildDealDeskPdf).mockResolvedValue(new Uint8Array(100));
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
      body: JSON.stringify({ policyId, format: "html" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with HTML containing outcome and score when format is html", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, format: "html" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const text = await res.text();
    expect(text).toBeTruthy();
    expect(text).toContain("Deal Desk Report");
  });

  it("returns 200 with PDF when format is pdf", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, format: "pdf" }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    const blob = await res.blob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
