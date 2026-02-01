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
vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/contractComplianceRepo");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";

describe("GET /api/contracts/[id]/versions/[versionId]/compliance", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";

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
      versions: [{ id: versionId, versionNumber: 1 }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(contractComplianceRepo.findManyContractCompliancesByContractVersion).mockResolvedValue([
      {
        id: "cc-1",
        contractVersionId: versionId,
        policyId: "p-1",
        score: 85,
        status: "COMPLIANT",
        policy: { id: "p-1", name: "Standard Policy" },
      },
    ] as Awaited<ReturnType<typeof contractComplianceRepo.findManyContractCompliancesByContractVersion>>);
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "TERMINATION",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "HIGH",
        riskType: "LEGAL",
        recommendation: "Clause required by policy is missing or not detected.",
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when contract not found", async () => {
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue(null);
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 with compliances and findings", async () => {
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contractVersionId).toBe(versionId);
    expect(json.compliances).toHaveLength(1);
    expect(json.compliances[0].policyName).toBe("Standard Policy");
    expect(json.compliances[0].score).toBe(85);
    expect(json.findings).toHaveLength(1);
    expect(json.findings[0].complianceStatus).toBe("VIOLATION");
  });
});
