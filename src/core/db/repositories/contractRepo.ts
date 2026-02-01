import { prisma } from "../prisma";
import type { ContractStatus, ContractType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type ListContractsFilters = {
  status?: ContractStatus;
  contractType?: ContractType;
  counterpartyId?: string;
};

export function createContract(data: Prisma.ContractCreateInput) {
  return prisma.contract.create({ data });
}

/**
 * Create contract and first version (v1) in a transaction. Race-safe.
 */
export async function createContractWithV1(
  data: Omit<Prisma.ContractCreateInput, "versions"> & { title: string }
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        ...data,
        title: data.title,
      },
    });
    await tx.contractVersion.create({
      data: {
        contractId: contract.id,
        versionNumber: 1,
      },
    });
    return tx.contract.findUniqueOrThrow({
      where: { id: contract.id },
      include: { counterparty: true, versions: true },
    });
  });
}

/**
 * Create next version for a contract. Uses transaction + max(versionNumber)+1 for race-safety.
 */
export async function createNextVersion(contractId: string) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.contractVersion.findFirst({
      where: { contractId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextNumber = (last?.versionNumber ?? 0) + 1;
    return tx.contractVersion.create({
      data: { contractId, versionNumber: nextNumber },
      include: { contract: true },
    });
  });
}

export function findContractById(id: string) {
  return prisma.contract.findUnique({
    where: { id },
    include: { counterparty: true, versions: { orderBy: { versionNumber: "asc" } } },
  });
}

/** Full detail for contract detail page (versions with documents). */
export function getContractDetail(id: string) {
  return prisma.contract.findUnique({
    where: { id },
    include: {
      counterparty: true,
      versions: {
        orderBy: { versionNumber: "asc" },
        include: { documents: true },
      },
    },
  });
}

export function findManyContracts(args?: Prisma.ContractFindManyArgs) {
  return prisma.contract.findMany(args ?? {});
}

export function listContracts(
  workspaceId: string,
  filters?: ListContractsFilters,
  args?: Omit<Prisma.ContractFindManyArgs, "where">
) {
  const where: Prisma.ContractWhereInput = { workspaceId };
  if (filters?.status) where.status = filters.status;
  if (filters?.contractType) where.contractType = filters.contractType;
  if (filters?.counterpartyId) where.counterpartyId = filters.counterpartyId;
  return prisma.contract.findMany({
    ...args,
    where,
    orderBy: args?.orderBy ?? { createdAt: "desc" },
    include: { counterparty: true },
  });
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
