import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createContract(data: Prisma.ContractCreateInput) {
  return prisma.contract.create({ data });
}

export function findContractById(id: string) {
  return prisma.contract.findUnique({
    where: { id },
    include: { counterparty: true, versions: true },
  });
}

export function findManyContracts(args?: Prisma.ContractFindManyArgs) {
  return prisma.contract.findMany(args ?? {});
}

export function findManyContractsByWorkspace(
  workspaceId: string,
  args?: Omit<Prisma.ContractFindManyArgs, "where">
) {
  return prisma.contract.findMany({
    ...args,
    where: { workspaceId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function updateContract(id: string, data: Prisma.ContractUpdateInput) {
  return prisma.contract.update({ where: { id }, data });
}

export function deleteContract(id: string) {
  return prisma.contract.delete({ where: { id } });
}
