import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** POST: withdraw exception. RBAC: requester or ADMIN. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ exceptionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const userId = session.userId;
    const isAdmin = session.role === "ADMIN" || session.role === "OWNER";
    const { exceptionId } = await params;
    const exception = await exceptionRepo.findExceptionRequestByIdAndWorkspace(exceptionId, workspaceId);
    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }
    if (exception.status !== "REQUESTED") {
      return NextResponse.json(
        { error: `Only REQUESTED exceptions can be withdrawn (current: ${exception.status})` },
        { status: 400 }
      );
    }
    const isRequester = exception.requestedByUserId === userId;
    if (!isRequester && !isAdmin) {
      return NextResponse.json({ error: "Only the requester or an admin can withdraw this exception" }, { status: 403 });
    }
    await exceptionRepo.updateExceptionRequest(exceptionId, {
      status: "WITHDRAWN",
    });
    await recordEvent({
      workspaceId,
      actorUserId: userId,
      type: "EXCEPTION_WITHDRAWN",
      entityType: "ExceptionRequest",
      entityId: exceptionId,
      contractId: exception.contractId,
      contractVersionId: exception.contractVersionId,
      policyId: exception.policyId ?? undefined,
      exceptionId,
      metadata: { clauseType: exception.clauseType ?? undefined, title: exception.title },
    });
    return NextResponse.json({
      id: exceptionId,
      status: "WITHDRAWN",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
