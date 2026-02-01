import { prisma } from "../prisma";
import type { ClauseType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function createClauseFinding(data: Prisma.ClauseFindingCreateInput) {
  return prisma.clauseFinding.create({ data });
}

export function findClauseFindingById(id: string) {
  return prisma.clauseFinding.findUnique({ where: { id } });
}

export function findClauseFindingByVersionAndClauseType(
  contractVersionId: string,
  clauseType: ClauseType
) {
  return prisma.clauseFinding.findUnique({
    where: {
      contractVersionId_clauseType: { contractVersionId, clauseType },
    },
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
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function updateClauseFinding(id: string, data: Prisma.ClauseFindingUpdateInput) {
  return prisma.clauseFinding.update({ where: { id }, data });
}

export function deleteClauseFinding(id: string) {
  return prisma.clauseFinding.delete({ where: { id } });
}

export function upsertClauseFinding(
  contractVersionId: string,
  clauseType: ClauseType,
  data: Prisma.ClauseFindingCreateInput
) {
  return prisma.clauseFinding.upsert({
    where: {
      contractVersionId_clauseType: { contractVersionId, clauseType },
    },
    create: data,
    update: data,
  });
}
