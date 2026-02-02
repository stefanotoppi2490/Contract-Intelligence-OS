import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", () => ({
  requireRole: vi.fn(),
}));
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/db/repositories/documentRepo");
vi.mock("@/core/db/repositories/auditRepo", () => ({
  createAuditEvent: vi.fn(() => Promise.resolve()),
}));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as documentRepo from "@/core/db/repositories/documentRepo";

describe("POST /api/contracts/[id]/versions/[versionId]/documents", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";

  const memberSession = {
    user: { id: "u-1", email: "u@test.com", name: null, image: null },
    userId: "u-1",
    email: "u@test.com" as string | null,
    currentWorkspaceId: workspaceId,
    role: "MEMBER" as const,
  };

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue(memberSession);
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      versions: [{ id: versionId, versionNumber: 1, documents: [] }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(documentRepo.countDocumentsByContractVersion).mockResolvedValue(0);
    vi.mocked(documentRepo.attachDocumentToVersion).mockResolvedValue({
      id: "doc-1",
      originalName: "test.pdf",
      mimeType: "application/pdf",
      size: 1024,
      storageKey: "pending://x",
    } as Awaited<ReturnType<typeof documentRepo.attachDocumentToVersion>>);
  });

  it("returns 409 when version already has a document (one main document per version)", async () => {
    vi.mocked(documentRepo.countDocumentsByContractVersion).mockResolvedValue(1);
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalName: "test.pdf",
        mimeType: "application/pdf",
        size: 1024,
        storageKey: "pending://y",
        source: "UPLOAD",
      }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("already has a document");
    expect(documentRepo.attachDocumentToVersion).not.toHaveBeenCalled();
  });

  it("returns 201 and attaches when version has no document", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalName: "test.pdf",
        mimeType: "application/pdf",
        size: 1024,
        storageKey: "pending://z",
        source: "UPLOAD",
      }),
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(200);
    expect(documentRepo.attachDocumentToVersion).toHaveBeenCalledWith(
      versionId,
      expect.objectContaining({
        originalName: "test.pdf",
        mimeType: "application/pdf",
        size: 1024,
        source: "UPLOAD",
      })
    );
  });
});
