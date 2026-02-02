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
vi.mock("@/core/db/repositories/auditRepo", () => ({
  createAuditEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/services/policyEngine/policyEngine", () => ({
  analyze: vi.fn(() =>
    Promise.resolve({
      contractVersionId: "v-1",
      policyId: "p-1",
      score: 85,
      status: "COMPLIANT",
      findingsCount: 2,
      violationsCount: 1,
    })
  ),
  MissingExtractionsError: class MissingExtractionsError extends Error {
    code = "MISSING_EXTRACTIONS";
    constructor(message?: string) {
      super(message ?? "Run AI clause extraction first");
      this.name = "MissingExtractionsError";
    }
  },
}));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { analyze, MissingExtractionsError } from "@/core/services/policyEngine/policyEngine";

describe("POST /api/contracts/[id]/versions/[versionId]/analyze", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  const legalSession = {
    user: { id: "u-1", email: "u@test.com", name: null, image: null },
    userId: "u-1",
    email: "u@test.com" as string | null,
    currentWorkspaceId: workspaceId,
    role: "LEGAL" as const,
  };

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue(legalSession);
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      versions: [{ id: versionId, versionNumber: 1 }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(policyRepo.findPolicyById).mockResolvedValue({
      id: policyId,
      workspaceId,
      name: "Test Policy",
    } as Awaited<ReturnType<typeof policyRepo.findPolicyById>>);
  });

  it("returns 403 when user is VIEWER", async () => {
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
    expect(vi.mocked(analyze)).not.toHaveBeenCalled();
  });

  it("returns 400 when body lacks policyId", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 200 and runs analyze when LEGAL and policyId provided", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(analyze)).toHaveBeenCalledWith({
      contractVersionId: versionId,
      policyId,
    });
    const json = await res.json();
    expect(json.score).toBe(85);
    expect(json.status).toBe("COMPLIANT");
  });

  it("returns 409 with MISSING_EXTRACTIONS when analyze throws MissingExtractionsError", async () => {
    vi.mocked(analyze).mockRejectedValue(new MissingExtractionsError());
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("MISSING_EXTRACTIONS");
    expect(data.error).toContain("Run AI clause extraction");
  });
});
