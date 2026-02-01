import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createCounterparty(data: Prisma.CounterpartyCreateInput) {
  return prisma.counterparty.create({ data });
}

export function findCounterpartyById(id: string) {
  return prisma.counterparty.findUnique({ where: { id } });
}

export function findCounterpartyByWorkspaceAndName(workspaceId: string, name: string) {
  return prisma.counterparty.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
}

export function findManyCounterparties(args?: Prisma.CounterpartyFindManyArgs) {
  return prisma.counterparty.findMany(args ?? {});
}

export function findManyCounterpartiesByWorkspace(
  workspaceId: string,
  args?: Omit<Prisma.CounterpartyFindManyArgs, "where">
) {
  return prisma.counterparty.findMany({
    ...args,
    where: { workspaceId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function updateCounterparty(id: string, data: Prisma.CounterpartyUpdateInput) {
  return prisma.counterparty.update({ where: { id }, data });
}

export function deleteCounterparty(id: string) {
  return prisma.counterparty.delete({ where: { id } });
}
