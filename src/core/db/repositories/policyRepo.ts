import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createPolicy(data: Prisma.PolicyCreateInput) {
  return prisma.policy.create({ data });
}

export function findPolicyById(id: string) {
  return prisma.policy.findUnique({ where: { id } });
}

export function findPolicyByWorkspaceAndPolicyId(workspaceId: string, policyId: string) {
  return prisma.policy.findUnique({
    where: { workspaceId_policyId: { workspaceId, policyId } },
  });
}

export function findManyPolicies(args?: Prisma.PolicyFindManyArgs) {
  return prisma.policy.findMany(args ?? {});
}

export function findManyPoliciesByWorkspace(
  workspaceId: string,
  args?: Omit<Prisma.PolicyFindManyArgs, "where">
) {
  return prisma.policy.findMany({
    ...args,
    where: { workspaceId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function updatePolicy(id: string, data: Prisma.PolicyUpdateInput) {
  return prisma.policy.update({ where: { id }, data });
}

export function deletePolicy(id: string) {
  return prisma.policy.delete({ where: { id } });
}
