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
vi.mock("@/core/db/repositories/contractVersionTextRepo");
vi.mock("@/core/db/repositories/clauseExtractionRepo");
vi.mock("@/core/db/repositories/auditRepo", () => ({
  createAuditEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/core/services/storage/blobStore", () => ({
  downloadBlob: vi.fn(() => Promise.resolve(Buffer.from("Hello, World!", "utf-8"))),
}));
vi.mock("@/core/services/ledger/ledgerService", () => ({
  recordEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/core/services/extraction/extractText", () => ({
  extractFromBuffer: vi.fn(),
  getExtractorFromMime: vi.fn(() => "text/plain"),
}));
vi.mock("@/core/services/extraction/aiClauseExtractor", () => ({
  extractClausesNeutral: vi.fn(() => Promise.resolve([])),
}));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as documentRepo from "@/core/db/repositories/documentRepo";
import * as contractVersionTextRepo from "@/core/db/repositories/contractVersionTextRepo";
import * as clauseExtractionRepo from "@/core/db/repositories/clauseExtractionRepo";
import { extractFromBuffer } from "@/core/services/extraction/extractText";
import { extractClausesNeutral } from "@/core/services/extraction/aiClauseExtractor";

describe("POST /api/contracts/[id]/versions/[versionId]/extract-text", () => {
  const workspaceId = "ws-1";
  const contractId = "c-1";
  const versionId = "v-1";
  const docId = "doc-1";

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
    vi.mocked(documentRepo.findMainDocumentByContractVersion).mockResolvedValue({
      id: docId,
      contractVersionId: versionId,
      originalName: "test.txt",
      mimeType: "text/plain",
      size: 13,
      storageKey: "https://blob.example.com/fake",
      source: "UPLOAD",
    } as Awaited<ReturnType<typeof documentRepo.findMainDocumentByContractVersion>>);
    vi.mocked(contractVersionTextRepo.findContractVersionTextByVersionId).mockResolvedValue(null);
    vi.mocked(contractVersionTextRepo.upsertContractVersionText).mockResolvedValue({
      id: "txt-1",
      contractVersionId: versionId,
      text: "Sample text",
      extractor: "text/plain",
      status: "TEXT_READY",
      errorMessage: null,
      extractedAt: new Date(),
    } as Awaited<ReturnType<typeof contractVersionTextRepo.upsertContractVersionText>>);
    vi.mocked(documentRepo.updateDocument).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof documentRepo.updateDocument>>);
    vi.mocked(extractFromBuffer).mockResolvedValue({
      ok: true,
      text: "Contract full text here.",
      extractor: "text/plain",
    });
    vi.mocked(extractClausesNeutral).mockResolvedValue([]);
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
    const req = new Request("http://x", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: contractId, versionId }),
    });
    expect(res.status).toBe(403);
  });

  describe("STEP 8A: ClauseExtraction after TEXT_READY", () => {
    it("creates ClauseExtraction when text extraction succeeds and AI returns extractions", async () => {
      const extractions = [
        {
          clauseType: "TERMINATION" as const,
          extractedValue: { noticeDays: 30 },
          extractedText: "Either party may terminate with 30 days notice.",
          confidence: 0.9,
        },
      ];
      vi.mocked(extractClausesNeutral).mockResolvedValue(extractions);
      vi.mocked(clauseExtractionRepo.replaceExtractionsForVersion).mockResolvedValue([]);

      const req = new Request("http://x", { method: "POST" });
      const res = await POST(req, {
        params: Promise.resolve({ id: contractId, versionId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("TEXT_READY");
      expect(extractClausesNeutral).toHaveBeenCalledWith("Contract full text here.");
      expect(clauseExtractionRepo.replaceExtractionsForVersion).toHaveBeenCalledWith(
        workspaceId,
        contractId,
        versionId,
        extractions.map((e) => ({
          clauseType: e.clauseType,
          extractedValue: e.extractedValue,
          extractedText: e.extractedText,
          confidence: e.confidence,
          sourceLocation: undefined,
        }))
      );
    });

    it("does not block workflow when AI clause extraction fails", async () => {
      vi.mocked(extractClausesNeutral).mockRejectedValue(new Error("AI error"));
      vi.mocked(clauseExtractionRepo.replaceExtractionsForVersion).mockClear();

      const req = new Request("http://x", { method: "POST" });
      const res = await POST(req, {
        params: Promise.resolve({ id: contractId, versionId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("TEXT_READY");
      expect(clauseExtractionRepo.replaceExtractionsForVersion).not.toHaveBeenCalled();
    });

    it("does not call replaceExtractionsForVersion when AI returns no extractions", async () => {
      vi.mocked(extractClausesNeutral).mockResolvedValue([]);
      vi.mocked(clauseExtractionRepo.replaceExtractionsForVersion).mockClear();

      const req = new Request("http://x", { method: "POST" });
      const res = await POST(req, {
        params: Promise.resolve({ id: contractId, versionId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("TEXT_READY");
      expect(clauseExtractionRepo.replaceExtractionsForVersion).not.toHaveBeenCalled();
    });
  });
});
