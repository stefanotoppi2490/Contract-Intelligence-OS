import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { extractTextQuerySchema } from "@/lib/validations/document";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as documentRepo from "@/core/db/repositories/documentRepo";
import * as contractVersionTextRepo from "@/core/db/repositories/contractVersionTextRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";
import { downloadBlob } from "@/core/services/storage/blobStore";
import {
  extractFromBuffer,
  getExtractorFromMime,
} from "@/core/services/extraction/extractText";

const PREVIEW_LENGTH = 500;

/** POST: extract text from main document. Idempotent: if TEXT_READY and !force return existing; if ERROR allow retry. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const url = new URL(req.url);
    const queryParsed = extractTextQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    const force = queryParsed.success ? queryParsed.data.force === true : false;

    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const doc = await documentRepo.findMainDocumentByContractVersion(versionId);
    if (!doc) {
      return NextResponse.json(
        { error: "No document for this version. Upload a file first." },
        { status: 400 }
      );
    }
    if (!doc.storageKey || !doc.storageKey.startsWith("http")) {
      return NextResponse.json(
        { error: "Document has no blob URL. Re-upload the file." },
        { status: 400 }
      );
    }

    const existing = await contractVersionTextRepo.findContractVersionTextByVersionId(versionId);
    if (existing?.status === "TEXT_READY" && !force) {
      return NextResponse.json({
        status: "TEXT_READY",
        preview: existing.text.slice(0, PREVIEW_LENGTH),
        fullText: existing.text,
        extractedAt: existing.extractedAt.toISOString(),
        extractor: existing.extractor,
      });
    }

    let buffer: Buffer;
    try {
      buffer = await downloadBlob(doc.storageKey);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Download failed";
      const errorMessage = `Blob download failed: ${message}`;
      const textRecord = await contractVersionTextRepo.upsertContractVersionText(versionId, {
        text: "",
        extractor: getExtractorFromMime(doc.mimeType ?? "application/octet-stream"),
        status: "ERROR",
        errorMessage,
      });
      await documentRepo.updateDocument(doc.id, {
        ingestionStatus: "ERROR",
        lastError: errorMessage,
      });
      return NextResponse.json(
        { status: "ERROR", errorMessage, id: textRecord.id },
        { status: 200 }
      );
    }

    const mime = doc.mimeType ?? "application/octet-stream";
    const result = await extractFromBuffer(buffer, mime);

    if (result.ok) {
      const textRecord = await contractVersionTextRepo.upsertContractVersionText(versionId, {
        text: result.text,
        extractor: result.extractor,
        status: "TEXT_READY",
        errorMessage: null,
      });
      await documentRepo.updateDocument(doc.id, {
        ingestionStatus: "TEXT_READY",
        lastError: null,
      });
      await createAuditEvent({
        workspace: { connect: { id: workspaceId } },
        eventType: "text.extracted",
        actorUserId: session.userId,
        payload: { contractId, versionId, extractor: result.extractor },
      });
      return NextResponse.json({
        status: "TEXT_READY",
        preview: result.text.slice(0, PREVIEW_LENGTH),
        fullText: result.text,
        extractedAt: textRecord.extractedAt.toISOString(),
        extractor: result.extractor,
      });
    }

    const textRecord = await contractVersionTextRepo.upsertContractVersionText(versionId, {
      text: "",
      extractor: result.extractor,
      status: "ERROR",
      errorMessage: result.errorMessage,
    });
    await documentRepo.updateDocument(doc.id, {
      ingestionStatus: "ERROR",
      lastError: result.errorMessage,
    });
    return NextResponse.json({
      status: "ERROR",
      errorMessage: result.errorMessage,
      extractedAt: textRecord.extractedAt.toISOString(),
      extractor: result.extractor,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
