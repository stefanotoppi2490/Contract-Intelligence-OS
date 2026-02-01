import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

/**
 * Append-only: no update or delete. Create and read only.
 */
export function createRiskLedgerEvent(data: Prisma.RiskLedgerEventCreateInput) {
  return prisma.riskLedgerEvent.create({ data });
}

export function findRiskLedgerEventById(id: string) {
  return prisma.riskLedgerEvent.findUnique({ where: { id } });
}

export function findManyRiskLedgerEvents(args?: Prisma.RiskLedgerEventFindManyArgs) {
  return prisma.riskLedgerEvent.findMany(args ?? {});
}

export function findManyRiskLedgerEventsByWorkspace(
  workspaceId: string,
  args?: Omit<Prisma.RiskLedgerEventFindManyArgs, "where">
) {
  return prisma.riskLedgerEvent.findMany({
    ...args,
    where: { workspaceId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}
