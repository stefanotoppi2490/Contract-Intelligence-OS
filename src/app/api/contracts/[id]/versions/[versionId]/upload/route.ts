import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { ALLOWED_MIME_TYPES } from "@/lib/validations/document";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as documentRepo from "@/core/db/repositories/documentRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";
import { uploadBlob } from "@/core/services/storage/blobStore";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4.5 MB Vercel serverless limit; use 4 MB to be safe

/** POST: multipart form with "file". One main document per version (409 if exists). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const existingCount = await documentRepo.countDocumentsByContractVersion(versionId);
    if (existingCount >= 1) {
      return NextResponse.json(
        { error: "This version already has a document. Only one main document per version is allowed." },
        { status: 409 }
      );
    }
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file. Use multipart form field 'file'." },
        { status: 400 }
      );
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json(
        { error: "Allowed types: PDF, DOCX, TXT" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const pathname = `contracts/${contractId}/versions/${versionId}/${crypto.randomUUID()}/${file.name}`;
    let blobUrl: string;
    try {
      const result = await uploadBlob(buffer, pathname, { contentType: mime });
      blobUrl = result.url;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      return NextResponse.json(
        { error: `Blob upload failed: ${message}. Set BLOB_READ_WRITE_TOKEN for real uploads.` },
        { status: 502 }
      );
    }
    const doc = await documentRepo.createDocumentWithBlob(versionId, {
      originalName: file.name,
      mimeType: mime,
      size: file.size,
      storageKey: blobUrl,
      source: "UPLOAD",
      ingestionStatus: "UPLOADED",
    });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "document.uploaded",
      actorUserId: session.userId,
      payload: {
        documentId: doc.id,
        contractId,
        versionId,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
      },
    });
    return NextResponse.json({
      id: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      storageKey: doc.storageKey,
      ingestionStatus: doc.ingestionStatus,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
