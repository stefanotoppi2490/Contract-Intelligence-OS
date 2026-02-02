import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { decideExceptionSchema } from "@/lib/validations/exception";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** POST: approve or reject exception. RBAC: ADMIN/LEGAL/RISK only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ exceptionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["ADMIN", "LEGAL", "RISK"] });
    const workspaceId = session.currentWorkspaceId!;
    const { exceptionId } = await params;
    const exception = await exceptionRepo.findExceptionRequestByIdAndWorkspace(exceptionId, workspaceId);
    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }
    if (exception.status !== "REQUESTED") {
      return NextResponse.json(
        { error: `Exception is not pending decision (status: ${exception.status})` },
        { status: 400 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = decideExceptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { decision, decisionReason } = parsed.data;
    const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await exceptionRepo.updateExceptionRequest(exceptionId, {
      status: newStatus,
      decidedByUserId: session.userId,
      decidedAt: new Date(),
      decisionReason: decisionReason ?? null,
    });
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: decision === "APPROVE" ? "EXCEPTION_APPROVED" : "EXCEPTION_REJECTED",
      entityType: "ExceptionRequest",
      entityId: exceptionId,
      contractId: exception.contractId,
      contractVersionId: exception.contractVersionId,
      policyId: exception.policyId ?? undefined,
      exceptionId,
      metadata: { clauseType: exception.clauseType ?? undefined, decision, previousStatus: "REQUESTED" },
    });
    return NextResponse.json({
      id: exceptionId,
      status: newStatus,
      decidedByUserId: session.userId,
      decidedAt: new Date().toISOString(),
      decisionReason: decisionReason ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
