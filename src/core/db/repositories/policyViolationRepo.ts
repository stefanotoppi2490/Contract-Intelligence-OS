import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createPolicyViolation(data: Prisma.PolicyViolationCreateInput) {
  return prisma.policyViolation.create({ data });
}

export function findPolicyViolationById(id: string) {
  return prisma.policyViolation.findUnique({
    where: { id },
    include: { policy: true, contractVersion: true },
  });
}

export function findPolicyViolationByVersionAndPolicy(
  contractVersionId: string,
  policyId: string
) {
  return prisma.policyViolation.findUnique({
    where: {
      contractVersionId_policyId: { contractVersionId, policyId },
    },
    include: { policy: true },
  });
}

export function findManyPolicyViolations(args?: Prisma.PolicyViolationFindManyArgs) {
  return prisma.policyViolation.findMany(args ?? {});
}

export function findManyPolicyViolationsByContractVersion(
  contractVersionId: string,
  args?: Omit<Prisma.PolicyViolationFindManyArgs, "where">
) {
  return prisma.policyViolation.findMany({
    ...args,
    where: { contractVersionId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function updatePolicyViolation(id: string, data: Prisma.PolicyViolationUpdateInput) {
  return prisma.policyViolation.update({ where: { id }, data });
}

export function deletePolicyViolation(id: string) {
  return prisma.policyViolation.delete({ where: { id } });
}
