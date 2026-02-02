import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as ledgerRepo from "@/core/db/repositories/ledgerRepo";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import * as userRepo from "@/core/db/repositories/userRepo";
import { formatLedgerSummary } from "@/core/services/ledger/ledgerSummary";
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

/** GET: list ledger events for workspace. Filters: type, contractId. Pagination: limit (default 50). RBAC: any role. Includes summary. */
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

    const contractIds = [...new Set(events.map((e) => e.contractId).filter(Boolean))] as string[];
    const policyIds = [...new Set(events.map((e) => e.policyId).filter(Boolean))] as string[];
    const exceptionIds = [...new Set(events.map((e) => e.exceptionId).filter(Boolean))] as string[];
    const actorUserIds = [...new Set(events.map((e) => e.actorUserId).filter(Boolean))] as string[];

    const [contracts, policies, exceptions, users] = await Promise.all([
      contractRepo.findManyContractsByIds(contractIds),
      policyRepo.findManyPoliciesByIds(policyIds),
      exceptionRepo.findManyExceptionRequestsByIds(exceptionIds),
      userRepo.findManyUsersByIds(actorUserIds),
    ]);

    const contractTitleById: Record<string, string> = {};
    for (const c of contracts) contractTitleById[c.id] = c.title;
    const policyNameById: Record<string, string> = {};
    for (const p of policies) policyNameById[p.id] = p.name;
    const exceptionTitleById: Record<string, string> = {};
    const exceptionClauseTypeById: Record<string, string> = {};
    for (const ex of exceptions) {
      exceptionTitleById[ex.id] = ex.title;
      if (ex.clauseType) exceptionClauseTypeById[ex.id] = ex.clauseType;
    }
    const actorNameById: Record<string, string> = {};
    for (const u of users) actorNameById[u.id] = u.name ?? u.email;

    const ctx = {
      contractTitleById,
      policyNameById,
      exceptionTitleById,
      exceptionClauseTypeById,
      actorNameById,
    };

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
      summary: formatLedgerSummary(
        {
          type: e.type,
          entityType: e.entityType,
          entityId: e.entityId,
          contractId: e.contractId,
          policyId: e.policyId,
          exceptionId: e.exceptionId,
          metadata: e.metadata as Record<string, unknown> | null,
        },
        ctx
      ),
    }));
    return NextResponse.json({ events: payload });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
