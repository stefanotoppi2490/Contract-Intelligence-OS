/**
 * Centralized ledger (audit trail) for workspace events.
 * Append-only; no update or delete.
 */

import type { Prisma } from "@prisma/client";
import type { LedgerEventType } from "@prisma/client";
import { createLedgerEvent } from "@/core/db/repositories/ledgerRepo";

export type RecordEventInput = {
  workspaceId: string;
  actorUserId: string | null;
  type: LedgerEventType;
  entityType: string;
  entityId: string;
  contractId?: string | null;
  contractVersionId?: string | null;
  policyId?: string | null;
  exceptionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function recordEvent(input: RecordEventInput) {
  return createLedgerEvent({
    workspace: { connect: { id: input.workspaceId } },
    actorUserId: input.actorUserId ?? undefined,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    contractId: input.contractId ?? undefined,
    contractVersionId: input.contractVersionId ?? undefined,
    policyId: input.policyId ?? undefined,
    exceptionId: input.exceptionId ?? undefined,
    metadata: input.metadata != null ? (input.metadata as Prisma.InputJsonValue) : undefined,
  });
}
