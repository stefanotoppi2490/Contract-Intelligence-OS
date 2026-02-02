import { prisma } from "../prisma";
import type { ClauseTaxonomy, PolicyRuleType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function createPolicyRule(data: Prisma.PolicyRuleCreateInput) {
  return prisma.policyRule.create({ data });
}

export function findPolicyRuleById(id: string) {
  return prisma.policyRule.findUnique({ where: { id } });
}

export function findManyPolicyRulesByPolicyId(
  policyId: string,
  args?: Omit<Prisma.PolicyRuleFindManyArgs, "where">
) {
  return prisma.policyRule.findMany({
    ...args,
    where: { policyId },
    orderBy: args?.orderBy ?? { createdAt: "asc" },
  });
}

export function findManyPolicyRules(args?: Prisma.PolicyRuleFindManyArgs) {
  return prisma.policyRule.findMany(args ?? {});
}

export function updatePolicyRule(id: string, data: Prisma.PolicyRuleUpdateInput) {
  return prisma.policyRule.update({ where: { id }, data });
}

export function deletePolicyRule(id: string) {
  return prisma.policyRule.delete({ where: { id } });
}
