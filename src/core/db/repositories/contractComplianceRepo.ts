import { prisma } from "../prisma";
import type { ComplianceStatusType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function createContractCompliance(data: Prisma.ContractComplianceCreateInput) {
  return prisma.contractCompliance.create({ data });
}

export function findContractComplianceByVersionAndPolicy(
  contractVersionId: string,
  policyId: string
) {
  return prisma.contractCompliance.findUnique({
    where: {
      contractVersionId_policyId: { contractVersionId, policyId },
    },
    include: { policy: true },
  });
}

export function findManyContractCompliancesByContractVersion(
  contractVersionId: string,
  args?: Omit<Prisma.ContractComplianceFindManyArgs, "where">
) {
  return prisma.contractCompliance.findMany({
    ...args,
    where: { contractVersionId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
    include: args?.include ?? { policy: true },
  });
}

export function upsertContractCompliance(
  contractVersionId: string,
  policyId: string,
  data: { score: number; status: ComplianceStatusType }
) {
  return prisma.contractCompliance.upsert({
    where: {
      contractVersionId_policyId: { contractVersionId, policyId },
    },
    create: {
      contractVersionId,
      policyId,
      score: data.score,
      status: data.status,
    },
    update: {
      score: data.score,
      status: data.status,
    },
  });
}
