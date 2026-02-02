import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as ledgerRepo from "@/core/db/repositories/ledgerRepo";
import type { LedgerEventType } from "@prisma/client";

const LEDGER_EVENT_TYPES: LedgerEventType[] = [
  "CONTRACT_UPLOADED",
  "TEXT_EXTRACTED",
  "ANALYSIS_RUN",
  "EXCEPTION_REQUESTED",
  "EXCEPTION_APPROVED",
  "EXCEPTION_REJECTED",
  "EXCEPTION_WITHDRAWN",
  "POLICY_CREATED",
  "POLICY_RULE_CREATED",
  "POLICY_RULE_UPDATED",
  "POLICY_RULE_DELETED",
];

/** GET: list ledger events for workspace. Filters: type, contractId. Pagination: limit (default 50). RBAC: any role. */
export async function GET(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type");
    const type = typeParam && LEDGER_EVENT_TYPES.includes(typeParam as LedgerEventType)
      ? (typeParam as LedgerEventType)
      : undefined;
    const contractId = url.searchParams.get("contractId") ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
    const events = await ledgerRepo.findManyLedgerEventsByWorkspace(workspaceId, {
      type,
      contractId,
      limit,
    });
    const payload = events.map((e) => ({
      id: e.id,
      workspaceId: e.workspaceId,
      actorUserId: e.actorUserId,
      type: e.type,
      entityType: e.entityType,
      entityId: e.entityId,
      contractId: e.contractId,
      contractVersionId: e.contractVersionId,
      policyId: e.policyId,
      exceptionId: e.exceptionId,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    }));
    return NextResponse.json({ events: payload });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
