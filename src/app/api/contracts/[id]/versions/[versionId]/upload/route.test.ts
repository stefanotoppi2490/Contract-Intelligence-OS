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
vi.mock("@/core/db/repositories/documentRepo");
vi.mock("@/core/db/repositories/auditRepo", () => ({
  createAuditEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/core/services/storage/blobStore", () => ({
  uploadBlob: vi.fn(() => Promise.resolve({ url: "https://blob.example.com/fake" })),
}));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as documentRepo from "@/core/db/repositories/documentRepo";

describe("POST /api/contracts/[id]/versions/[versionId]/upload", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "MEMBER",
    });
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue({
      id: contractId,
      workspaceId,
      versions: [{ id: versionId, versionNumber: 1, documents: [] }],
    } as unknown as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(documentRepo.countDocumentsByContractVersion).mockResolvedValue(0);
    vi.mocked(documentRepo.createDocumentWithBlob).mockResolvedValue({
      id: "doc-1",
      originalName: "test.pdf",
      mimeType: "application/pdf",
      size: 1024,
      storageKey: "https://blob.example.com/fake",
      ingestionStatus: "UPLOADED",
    } as Awaited<ReturnType<typeof documentRepo.createDocumentWithBlob>>);
  });

  it("returns 403 when user is VIEWER", async () => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-viewer",
      currentWorkspaceId: workspaceId,
      role: "VIEWER",
    });
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.set("file", file);
    const req = new Request("http://x", { method: "POST", body: formData });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(403);
    expect(documentRepo.createDocumentWithBlob).not.toHaveBeenCalled();
  });

  it("returns 409 when version already has a document", async () => {
    vi.mocked(documentRepo.countDocumentsByContractVersion).mockResolvedValue(1);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.set("file", file);
    const req = new Request("http://x", { method: "POST", body: formData });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("already has a document");
    expect(documentRepo.createDocumentWithBlob).not.toHaveBeenCalled();
  });
});
