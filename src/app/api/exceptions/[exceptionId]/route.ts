import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import * as userRepo from "@/core/db/repositories/userRepo";

/** GET: single exception by id. Workspace-scoped. RBAC: any role. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ exceptionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { exceptionId } = await params;
    const exception = await exceptionRepo.findExceptionRequestByIdAndWorkspace(exceptionId, workspaceId);
    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }
    const userIds = [
      exception.requestedByUserId,
      exception.decidedByUserId,
      ...(exception.comments?.map((c) => c.userId) ?? []),
    ].filter(Boolean) as string[];
    const users = userIds.length ? await userRepo.findManyUsersByIds([...new Set(userIds)]) : [];
    const userMap = new Map(users.map((u) => [u.id, { name: u.name ?? u.email, email: u.email }]));
    const payload = {
      id: exception.id,
      workspaceId: exception.workspaceId,
      contractId: exception.contractId,
      contractVersionId: exception.contractVersionId,
      contractTitle: exception.contractVersion?.contract?.title ?? null,
      versionNumber: exception.contractVersion?.versionNumber ?? null,
      clauseFindingId: exception.clauseFindingId,
      policyId: exception.policyId,
      policyName: exception.policy?.name ?? null,
      clauseType: exception.clauseType,
      title: exception.title,
      justification: exception.justification,
      requestedByUserId: exception.requestedByUserId,
      requestedBy: userMap.get(exception.requestedByUserId) ?? null,
      status: exception.status,
      decidedByUserId: exception.decidedByUserId,
      decidedBy: exception.decidedByUserId ? userMap.get(exception.decidedByUserId) ?? null : null,
      decidedAt: exception.decidedAt?.toISOString() ?? null,
      decisionReason: exception.decisionReason,
      createdAt: exception.createdAt.toISOString(),
      updatedAt: exception.updatedAt.toISOString(),
      finding: exception.clauseFinding
        ? {
            id: exception.clauseFinding.id,
            clauseType: exception.clauseFinding.clauseType,
            complianceStatus: exception.clauseFinding.complianceStatus,
            severity: exception.clauseFinding.severity,
            riskType: exception.clauseFinding.riskType,
            recommendation: exception.clauseFinding.recommendation,
            foundText: exception.clauseFinding.foundText,
            foundValue: exception.clauseFinding.foundValue,
            confidence: exception.clauseFinding.confidence,
            expectedValue: exception.clauseFinding.rule?.expectedValue ?? null,
          }
        : null,
      comments: (exception.comments ?? []).map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: userMap.get(c.userId)?.name ?? null,
        message: c.message,
        createdAt: c.createdAt.toISOString(),
      })),
    };
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
