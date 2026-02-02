import { prisma } from "../prisma";
import type { LedgerEventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function createLedgerEvent(data: Prisma.LedgerEventCreateInput) {
  return prisma.ledgerEvent.create({ data });
}

export function findLedgerEventById(id: string) {
  return prisma.ledgerEvent.findUnique({ where: { id } });
}

export function findManyLedgerEvents(args?: Prisma.LedgerEventFindManyArgs) {
  return prisma.ledgerEvent.findMany(args ?? {});
}

export function findManyLedgerEventsByWorkspace(
  workspaceId: string,
  args?: Omit<Prisma.LedgerEventFindManyArgs, "where"> & {
    type?: LedgerEventType;
    contractId?: string;
    limit?: number;
  }
) {
  const where: Prisma.LedgerEventWhereInput = { workspaceId };
  if (args?.type) where.type = args.type;
  if (args?.contractId) where.contractId = args.contractId;
  const { type: _t, contractId: _c, limit = 50, ...rest } = args ?? {};
  return prisma.ledgerEvent.findMany({
    ...rest,
    where,
    orderBy: rest?.orderBy ?? { createdAt: "desc" },
    take: limit,
  });
}
