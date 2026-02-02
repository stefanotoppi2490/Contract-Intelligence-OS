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
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/services/compare/versionCompare");
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { compareVersions } from "@/core/services/compare/versionCompare";

describe("GET /api/contracts/[id]/compare", () => {
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
    vi.mocked(requireWorkspace).mockImplementation(() => {});
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
    vi.mocked(compareVersions).mockResolvedValue({
      ok: true,
      result: {
        from: { versionId: fromVersionId, versionNumber: 1, rawScore: 80, effectiveScore: 80 },
        to: { versionId: toVersionId, versionNumber: 2, rawScore: 85, effectiveScore: 85 },
        delta: { raw: 5, effective: 5, label: "IMPROVED" as const },
        changes: [],
        topDrivers: [],
      },
    });
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const url = `http://x?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}&policyId=${policyId}`;
    const res = await GET(new Request(url), {
      params: Promise.resolve({ id: contractId }),
    });
    expect(res.status).toBe(403);
    expect(vi.mocked(compareVersions)).not.toHaveBeenCalled();
  });

  it("returns 400 when query lacks fromVersionId, toVersionId, or policyId", async () => {
    const res = await GET(
      new Request(`http://x?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}`),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when contract not found (cross-workspace)", async () => {
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue(null);
    const url = `http://x?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}&policyId=${policyId}`;
    const res = await GET(new Request(url), {
      params: Promise.resolve({ id: contractId }),
    });
    expect(res.status).toBe(404);
    expect(vi.mocked(compareVersions)).not.toHaveBeenCalled();
  });

  it("returns 409 with MISSING_ANALYSIS when compare returns missing analysis", async () => {
    vi.mocked(compareVersions).mockResolvedValue({
      ok: false,
      code: "MISSING_ANALYSIS",
      missingVersionId: toVersionId,
    });
    const url = `http://x?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}&policyId=${policyId}`;
    const res = await GET(new Request(url), {
      params: Promise.resolve({ id: contractId }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("MISSING_ANALYSIS");
    expect(json.missingVersionId).toBe(toVersionId);
  });

  it("returns 200 and compare result when all params valid", async () => {
    const url = `http://x?fromVersionId=${fromVersionId}&toVersionId=${toVersionId}&policyId=${policyId}`;
    const res = await GET(new Request(url), {
      params: Promise.resolve({ id: contractId }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.from.versionNumber).toBe(1);
    expect(json.to.versionNumber).toBe(2);
    expect(json.delta.label).toBe("IMPROVED");
  });
});
