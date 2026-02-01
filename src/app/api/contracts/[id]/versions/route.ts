import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId } = await params;
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = await contractRepo.createNextVersion(contractId, workspaceId);
    if (!version) {
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "contract_version.created",
      actorUserId: session.userId,
      payload: { contractId, versionId: version.id, versionNumber: version.versionNumber },
    });
    return NextResponse.json(version);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
