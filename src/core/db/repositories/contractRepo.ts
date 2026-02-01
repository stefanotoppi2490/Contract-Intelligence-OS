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

const MAX_VERSION_RETRIES = 3;

/**
 * Create next version for a contract. Enforces workspace scoping; uses transaction + retry on
 * unique (contractId, versionNumber) for race-safety.
 */
export async function createNextVersion(contractId: string, workspaceId: string) {
  for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const contract = await tx.contract.findFirst({
          where: { id: contractId, workspaceId },
          select: { id: true },
        });
        if (!contract) return null;
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
    } catch (e: unknown) {
      const isUniqueViolation =
        e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
      if (isUniqueViolation && attempt < MAX_VERSION_RETRIES - 1) continue;
      throw e;
    }
  }
  return null;
}

export function findContractById(id: string) {
  return prisma.contract.findUnique({
    where: { id },
    include: { counterparty: true, versions: { orderBy: { versionNumber: "asc" } } },
  });
}

/** Full detail for contract detail page (versions with documents, versionText, compliance, findings). Workspace-scoped. */
export function getContractDetail(id: string, workspaceId: string) {
  return prisma.contract.findUnique({
    where: { id, workspaceId },
    include: {
      counterparty: true,
      versions: {
        orderBy: { versionNumber: "asc" },
        include: {
          documents: true,
          versionText: true,
          contractCompliance: { include: { policy: true } },
          clauseFindings: { include: { rule: true } },
        },
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
