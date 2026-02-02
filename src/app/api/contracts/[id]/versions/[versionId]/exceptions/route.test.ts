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
vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/exceptionRepo");
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

describe("POST /api/contracts/[id]/versions/[versionId]/exceptions", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const findingId = "f-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "LEGAL",
    } as Awaited<ReturnType<typeof getServerSessionWithWorkspace>>);
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      versions: [{ id: versionId }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(clauseFindingRepo.findClauseFindingById).mockResolvedValue({
      id: findingId,
      contractVersionId: versionId,
      clauseType: "TERMINATION",
      rule: { policyId: "p-1" },
    } as Awaited<ReturnType<typeof clauseFindingRepo.findClauseFindingById>>);
    vi.mocked(exceptionRepo.findActiveExceptionByClauseFindingId).mockResolvedValue(null);
    vi.mocked(exceptionRepo.createExceptionRequest).mockResolvedValue({
      id: "ex-1",
      contractVersionId: versionId,
      clauseFindingId: findingId,
      policyId: "p-1",
      clauseType: "TERMINATION",
      title: "Request",
      status: "REQUESTED",
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof exceptionRepo.createExceptionRequest>>);
  });

  it("returns 403 when VIEWER", async () => {
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauseFindingId: findingId, title: "T", justification: "J" }),
      }),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when active exception exists for same finding", async () => {
    vi.mocked(exceptionRepo.findActiveExceptionByClauseFindingId).mockResolvedValue({
      id: "ex-existing",
    } as Awaited<ReturnType<typeof exceptionRepo.findActiveExceptionByClauseFindingId>>);
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauseFindingId: findingId, title: "T", justification: "J" }),
      }),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.existingExceptionId).toBe("ex-existing");
  });

  it("returns 201 and creates exception when no dedupe", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauseFindingId: findingId, title: "Request", justification: "Reason" }),
      }),
      { params: Promise.resolve({ id: contractId, versionId }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("ex-1");
    expect(json.status).toBe("REQUESTED");
  });
});
