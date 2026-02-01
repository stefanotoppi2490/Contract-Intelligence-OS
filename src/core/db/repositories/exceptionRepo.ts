import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createExceptionRequest(data: Prisma.ExceptionRequestCreateInput) {
  return prisma.exceptionRequest.create({ data });
}

export function findExceptionRequestById(id: string) {
  return prisma.exceptionRequest.findUnique({
    where: { id },
    include: { policy: true, contractVersion: true },
  });
}

export function findPendingExceptionByVersionAndPolicy(
  contractVersionId: string,
  policyId: string
) {
  return prisma.exceptionRequest.findFirst({
    where: {
      contractVersionId,
      policyId,
      status: "PENDING",
    },
    include: { policy: true },
  });
}

export function findManyExceptionRequests(args?: Prisma.ExceptionRequestFindManyArgs) {
  return prisma.exceptionRequest.findMany(args ?? {});
}

export function findManyExceptionRequestsByContractVersion(
  contractVersionId: string,
  args?: Omit<Prisma.ExceptionRequestFindManyArgs, "where">
) {
  return prisma.exceptionRequest.findMany({
    ...args,
    where: { contractVersionId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function findManyPendingExceptionsByWorkspace(workspaceId: string) {
  return prisma.exceptionRequest.findMany({
    where: {
      status: "PENDING",
      contractVersion: { contract: { workspaceId } },
    },
    include: { policy: true, contractVersion: { include: { contract: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function updateExceptionRequest(id: string, data: Prisma.ExceptionRequestUpdateInput) {
  return prisma.exceptionRequest.update({ where: { id }, data });
}

export function deleteExceptionRequest(id: string) {
  return prisma.exceptionRequest.delete({ where: { id } });
}
