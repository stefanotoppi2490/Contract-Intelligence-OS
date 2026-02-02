import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireRole: vi.fn() };
});
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/workspaceRepo");
vi.mock("@/core/services/compare/versionCompare");
vi.mock("@/core/services/reports/versionCompareReport");
vi.mock("@/core/services/reports/versionComparePdf", () => ({
  buildComparePdf: vi.fn(),
}));
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import { compareVersions } from "@/core/services/compare/versionCompare";
import { buildComparePdf } from "@/core/services/reports/versionComparePdf";

const sampleResult = {
  from: { versionId: "v-1", versionNumber: 1, rawScore: 80, effectiveScore: 80 },
  to: { versionId: "v-2", versionNumber: 2, rawScore: 85, effectiveScore: 85 },
  delta: { raw: 5, effective: 5, label: "IMPROVED" as const },
  changes: [],
  topDrivers: [],
};

describe("POST /api/contracts/[id]/compare/report", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const fromVersionId = "v-1";
  const toVersionId = "v-2";
  const policyId = "p-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "LEGAL",
    });
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      title: "Contract",
      versions: [
        { id: fromVersionId, versionNumber: 1 },
        { id: toVersionId, versionNumber: 2 },
      ],
    } as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue({
      id: policyId,
      workspaceId,
      name: "Policy",
    } as Awaited<ReturnType<typeof policyRepo.findPolicyByWorkspaceAndId>>);
    vi.mocked(workspaceRepo.findWorkspaceById).mockResolvedValue({
      id: workspaceId,
      name: "Workspace",
    } as Awaited<ReturnType<typeof workspaceRepo.findWorkspaceById>>);
    vi.mocked(compareVersions).mockResolvedValue({
      ok: true,
      result: sampleResult,
    });
  });

  it("format=pdf returns Content-Type application/pdf and non-empty body", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    vi.mocked(buildComparePdf).mockResolvedValue(pdfBytes);

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromVersionId,
          toVersionId,
          policyId,
          format: "pdf",
        }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Contract_Compare_v1_vs_v2.pdf");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
    expect(new Uint8Array(body).slice(0, 4)).toEqual(pdfBytes);
  });
});
