/**
 * STEP 11: DealDecision repository — one decision per contractVersionId + policyId.
 */

import { prisma } from "../prisma";
import type { DealDecisionOutcome, DealDecisionStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function findDealDecisionByVersionAndPolicy(
  contractVersionId: string,
  policyId: string
) {
  return prisma.dealDecision.findUnique({
    where: {
      contractVersionId_policyId: { contractVersionId, policyId },
    },
    include: { policy: { select: { name: true } } },
  });
}

export function upsertDealDecisionDraft(data: {
  workspaceId: string;
  contractId: string;
  contractVersionId: string;
  policyId: string;
  outcome: DealDecisionOutcome;
  rationale: string;
  executiveSummary?: string | null;
  createdByUserId: string;
}) {
  return prisma.dealDecision.upsert({
    where: {
      contractVersionId_policyId: {
        contractVersionId: data.contractVersionId,
        policyId: data.policyId,
      },
    },
    create: {
      workspaceId: data.workspaceId,
      contractId: data.contractId,
      contractVersionId: data.contractVersionId,
      policyId: data.policyId,
      status: "DRAFT",
      outcome: data.outcome,
      rationale: data.rationale,
      executiveSummary: data.executiveSummary ?? null,
      createdByUserId: data.createdByUserId,
    },
    update: {
      outcome: data.outcome,
      rationale: data.rationale,
      executiveSummary: data.executiveSummary ?? undefined,
      status: "DRAFT",
      updatedAt: new Date(),
    },
    include: { policy: { select: { name: true } } },
  });
}

/** Creates a new DealDecision (e.g. when finalizing and no draft exists). */
export function createDealDecision(data: {
  workspaceId: string;
  contractId: string;
  contractVersionId: string;
  policyId: string;
  status: DealDecisionStatus;
  outcome: DealDecisionOutcome;
  rationale: string;
  executiveSummary?: string | null;
  createdByUserId: string;
  finalizedByUserId?: string | null;
  finalizedAt?: Date | null;
}) {
  return prisma.dealDecision.create({
    data: {
      workspaceId: data.workspaceId,
      contractId: data.contractId,
      contractVersionId: data.contractVersionId,
      policyId: data.policyId,
      status: data.status,
      outcome: data.outcome,
      rationale: data.rationale,
      executiveSummary: data.executiveSummary ?? null,
      createdByUserId: data.createdByUserId,
      finalizedByUserId: data.finalizedByUserId ?? null,
      finalizedAt: data.finalizedAt ?? null,
    },
    include: { policy: { select: { name: true } } },
  });
}

/** Sets status=FINAL, finalizedByUserId, finalizedAt. Caller must ensure decision exists (create from engine first if needed). */
export function finalizeDealDecision(
  contractVersionId: string,
  policyId: string,
  finalizedByUserId: string
) {
  const now = new Date();
  return prisma.dealDecision.update({
    where: {
      contractVersionId_policyId: { contractVersionId, policyId },
    },
    data: {
      status: "FINAL" as DealDecisionStatus,
      finalizedByUserId,
      finalizedAt: now,
      updatedAt: now,
    },
    include: { policy: { select: { name: true } } },
  });
}

export function updateDealDecisionExecutiveSummary(
  contractVersionId: string,
  policyId: string,
  executiveSummary: string | null
) {
  return prisma.dealDecision.update({
    where: {
      contractVersionId_policyId: { contractVersionId, policyId },
    },
    data: { executiveSummary, updatedAt: new Date() },
  });
}
