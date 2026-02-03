import { prisma } from "../prisma";
import type { ExceptionStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const ACTIVE_EXCEPTION_STATUSES: ExceptionStatus[] = ["REQUESTED", "APPROVED"];

export function createExceptionRequest(data: Prisma.ExceptionRequestCreateInput) {
  return prisma.exceptionRequest.create({ data });
}

export function findExceptionRequestById(id: string) {
  return prisma.exceptionRequest.findUnique({
    where: { id },
    include: {
      policy: true,
      contractVersion: { include: { contract: true } },
      clauseFinding: { include: { rule: true } },
      comments: true,
    },
  });
}

export function findExceptionRequestByIdAndWorkspace(id: string, workspaceId: string) {
  return prisma.exceptionRequest.findFirst({
    where: { id, workspaceId },
    include: {
      policy: true,
      contractVersion: { include: { contract: true } },
      clauseFinding: { include: { rule: true } },
      comments: true,
    },
  });
}

/** Active = REQUESTED or APPROVED. Only one per clauseFindingId. */
export function findActiveExceptionByClauseFindingId(clauseFindingId: string) {
  return prisma.exceptionRequest.findFirst({
    where: {
      clauseFindingId,
      status: { in: ACTIVE_EXCEPTION_STATUSES },
    },
    include: { policy: true },
  });
}

/** One REQUESTED exception per (contractVersionId, policyId, title) when clauseFindingId is null. */
export function findRequestedExceptionByVersionPolicyTitle(
  contractVersionId: string,
  policyId: string,
  title: string
) {
  return prisma.exceptionRequest.findFirst({
    where: {
      contractVersionId,
      policyId,
      title: { equals: title, mode: "insensitive" },
      status: "REQUESTED",
      clauseFindingId: null,
    },
  });
}

export function findManyExceptionRequests(args?: Prisma.ExceptionRequestFindManyArgs) {
  return prisma.exceptionRequest.findMany(args ?? {});
}

export function findManyExceptionRequestsByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.exceptionRequest.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, clauseType: true },
  });
}

export function findManyExceptionRequestsByWorkspace(
  workspaceId: string,
  filters?: { status?: ExceptionStatus; contractId?: string; policyId?: string },
  args?: Omit<Prisma.ExceptionRequestFindManyArgs, "where">
) {
  const where: Prisma.ExceptionRequestWhereInput = { workspaceId };
  if (filters?.status) where.status = filters.status;
  if (filters?.contractId) where.contractId = filters.contractId;
  if (filters?.policyId) where.policyId = filters.policyId;
  return prisma.exceptionRequest.findMany({
    ...args,
    where,
    orderBy: args?.orderBy ?? { createdAt: "desc" },
    include: args?.include ?? {
      contractVersion: { include: { contract: true } },
      policy: true,
      clauseFinding: { include: { rule: true } },
    },
  });
}

export function findManyExceptionRequestsByContractVersion(
  contractVersionId: string,
  args?: Omit<Prisma.ExceptionRequestFindManyArgs, "where">
) {
  return prisma.exceptionRequest.findMany({
    ...args,
    where: { contractVersionId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
    include: args?.include ?? { policy: true, clauseFinding: true },
  });
}

/** Approved exceptions for a version that are linked to a clause finding (for compliance override). */
export function findApprovedExceptionsByContractVersion(contractVersionId: string) {
  return prisma.exceptionRequest.findMany({
    where: {
      contractVersionId,
      status: "APPROVED",
      clauseFindingId: { not: null },
    },
    select: { id: true, clauseFindingId: true },
  });
}

/** Approved exceptions for a version with title (for export snapshot). */
export function findApprovedExceptionsWithTitlesByContractVersion(contractVersionId: string) {
  return prisma.exceptionRequest.findMany({
    where: {
      contractVersionId,
      status: "APPROVED",
      clauseFindingId: { not: null },
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
}

export function updateExceptionRequest(id: string, data: Prisma.ExceptionRequestUpdateInput) {
  return prisma.exceptionRequest.update({ where: { id }, data });
}

export function deleteExceptionRequest(id: string) {
  return prisma.exceptionRequest.delete({ where: { id } });
}

export function createExceptionComment(data: Prisma.ExceptionCommentCreateInput) {
  return prisma.exceptionComment.create({ data });
}
