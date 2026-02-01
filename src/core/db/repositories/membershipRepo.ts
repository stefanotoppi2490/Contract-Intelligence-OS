import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createMembership(data: Prisma.MembershipCreateInput) {
  return prisma.membership.create({ data });
}

export function findMembershipById(id: string) {
  return prisma.membership.findUnique({ where: { id }, include: { workspace: true, user: true } });
}

export function findMembershipByWorkspaceAndUser(workspaceId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true, user: true },
  });
}

export function findManyMemberships(args?: Prisma.MembershipFindManyArgs) {
  return prisma.membership.findMany(args ?? {});
}

export function findManyMembershipsByWorkspace(workspaceId: string, args?: Omit<Prisma.MembershipFindManyArgs, "where">) {
  return prisma.membership.findMany({ ...args, where: { workspaceId } });
}

export function findManyMembershipsByUser(userId: string, args?: Omit<Prisma.MembershipFindManyArgs, "where">) {
  return prisma.membership.findMany({ ...args, where: { userId } });
}

export function updateMembership(id: string, data: Prisma.MembershipUpdateInput) {
  return prisma.membership.update({ where: { id }, data });
}

export function deleteMembership(id: string) {
  return prisma.membership.delete({ where: { id } });
}
