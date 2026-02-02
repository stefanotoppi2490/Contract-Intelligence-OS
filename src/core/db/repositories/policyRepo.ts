import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createPolicy(data: Prisma.PolicyCreateInput) {
  return prisma.policy.create({ data });
}

export function findPolicyById(id: string) {
  return prisma.policy.findUnique({
    where: { id },
    include: { rules: true },
  });
}

/** For RBAC: ensure policy belongs to workspace. */
export function findPolicyByWorkspaceAndId(workspaceId: string, policyId: string) {
  return prisma.policy.findFirst({
    where: { id: policyId, workspaceId },
    include: { rules: true },
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
    where: { workspaceId, isActive: true },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
    include: args?.include ?? { rules: true },
  });
}

export function updatePolicy(id: string, data: Prisma.PolicyUpdateInput) {
  return prisma.policy.update({ where: { id }, data });
}
