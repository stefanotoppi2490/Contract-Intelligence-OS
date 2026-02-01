import { prisma } from "../prisma";
import type { ClauseTaxonomy, FindingComplianceStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function createClauseFinding(data: Prisma.ClauseFindingCreateInput) {
  return prisma.clauseFinding.create({ data });
}

export function findClauseFindingById(id: string) {
  return prisma.clauseFinding.findUnique({
    where: { id },
    include: { rule: true },
  });
}

export function findClauseFindingByVersionAndRule(
  contractVersionId: string,
  ruleId: string
) {
  return prisma.clauseFinding.findUnique({
    where: {
      contractVersionId_ruleId: { contractVersionId, ruleId },
    },
    include: { rule: true },
  });
}

export function findManyClauseFindings(args?: Prisma.ClauseFindingFindManyArgs) {
  return prisma.clauseFinding.findMany(args ?? {});
}

export function findManyClauseFindingsByContractVersion(
  contractVersionId: string,
  args?: Omit<Prisma.ClauseFindingFindManyArgs, "where">
) {
  return prisma.clauseFinding.findMany({
    ...args,
    where: { contractVersionId },
    orderBy: args?.orderBy ?? { createdAt: "asc" },
    include: args?.include ?? { rule: true },
  });
}

export function upsertClauseFinding(
  contractVersionId: string,
  ruleId: string,
  data: Omit<Prisma.ClauseFindingCreateInput, "contractVersion" | "rule">
) {
  return prisma.clauseFinding.upsert({
    where: {
      contractVersionId_ruleId: { contractVersionId, ruleId },
    },
    create: {
      contractVersionId,
      ruleId,
      ...data,
    },
    update: data,
  });
}
