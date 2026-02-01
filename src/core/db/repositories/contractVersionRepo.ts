import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createContractVersion(data: Prisma.ContractVersionCreateInput) {
  return prisma.contractVersion.create({ data });
}

export function findContractVersionById(id: string) {
  return prisma.contractVersion.findUnique({
    where: { id },
    include: {
      contract: true,
      documents: true,
      clauseFindings: true,
      policyViolations: true,
      exceptionRequests: true,
    },
  });
}

export function findContractVersionByContractAndNumber(contractId: string, versionNumber: number) {
  return prisma.contractVersion.findUnique({
    where: { contractId_versionNumber: { contractId, versionNumber } },
  });
}

export function findManyContractVersions(args?: Prisma.ContractVersionFindManyArgs) {
  return prisma.contractVersion.findMany(args ?? {});
}

export function findManyContractVersionsByContract(
  contractId: string,
  args?: Omit<Prisma.ContractVersionFindManyArgs, "where">
) {
  return prisma.contractVersion.findMany({
    ...args,
    where: { contractId },
    orderBy: args?.orderBy ?? { versionNumber: "desc" },
  });
}

export function updateContractVersion(id: string, data: Prisma.ContractVersionUpdateInput) {
  return prisma.contractVersion.update({ where: { id }, data });
}

export function deleteContractVersion(id: string) {
  return prisma.contractVersion.delete({ where: { id } });
}
