import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

/**
 * Append-only: no update or delete. Create and read only.
 */
export function createAuditEvent(data: Prisma.AuditEventCreateInput) {
  return prisma.auditEvent.create({ data });
}

export function findAuditEventById(id: string) {
  return prisma.auditEvent.findUnique({ where: { id } });
}

export function findManyAuditEvents(args?: Prisma.AuditEventFindManyArgs) {
  return prisma.auditEvent.findMany(args ?? {});
}

export function findManyAuditEventsByWorkspace(
  workspaceId: string,
  args?: Omit<Prisma.AuditEventFindManyArgs, "where">
) {
  return prisma.auditEvent.findMany({
    ...args,
    where: { workspaceId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}
