import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import { attachDocumentSchema } from "@/lib/validations/document";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as contractVersionRepo from "@/core/db/repositories/contractVersionRepo";
import * as documentRepo from "@/core/db/repositories/documentRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const contract = await contractRepo.findContractById(contractId);
    if (!contract || contract.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = await contractVersionRepo.findContractVersionById(versionId);
    if (!version || version.contractId !== contractId) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const body = await req.json();
    const parsed = attachDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const storageKey =
      parsed.data.storageKey ?? `pending://${randomUUID()}`;
    const doc = await documentRepo.attachDocumentToVersion(versionId, {
      originalName: parsed.data.originalName,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
      storageKey,
      source: parsed.data.source,
    });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "document.attached",
      actorUserId: session.userId,
      payload: {
        documentId: doc.id,
        contractId,
        versionId,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
      },
    });
    return NextResponse.json(doc);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
