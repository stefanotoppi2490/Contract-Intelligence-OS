import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { exceptionListQuerySchema } from "@/lib/validations/exception";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import * as userRepo from "@/core/db/repositories/userRepo";

/** GET: list exceptions for workspace. Filters: status, contractId, policyId. RBAC: any role (VIEWER can read). */
export async function GET(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const url = new URL(req.url);
    const queryParsed = exceptionListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      contractId: url.searchParams.get("contractId") ?? undefined,
      policyId: url.searchParams.get("policyId") ?? undefined,
    });
    const filters = queryParsed.success ? queryParsed.data : {};
    const list = await exceptionRepo.findManyExceptionRequestsByWorkspace(workspaceId, filters);
    const userIds = [...new Set([...list.map((e) => e.requestedByUserId), ...list.map((e) => e.decidedByUserId).filter(Boolean)])] as string[];
    const users = userIds.length ? await userRepo.findManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]));
    const payload = list.map((e) => {
      const version = e.contractVersion as { contract?: { title: string } } | null;
      return {
      id: e.id,
      workspaceId: e.workspaceId,
      contractId: e.contractId,
      contractVersionId: e.contractVersionId,
      contractTitle: version?.contract?.title ?? null,
      clauseFindingId: e.clauseFindingId,
      policyId: e.policyId,
      clauseType: e.clauseType,
      title: e.title,
      justification: e.justification,
      requestedByUserId: e.requestedByUserId,
      requestedByName: userMap.get(e.requestedByUserId) ?? null,
      status: e.status,
      decidedByUserId: e.decidedByUserId,
      decidedByName: e.decidedByUserId ? userMap.get(e.decidedByUserId) ?? null : null,
      decidedAt: e.decidedAt?.toISOString() ?? null,
      decisionReason: e.decisionReason,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
    });
    return NextResponse.json({ exceptions: payload });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
