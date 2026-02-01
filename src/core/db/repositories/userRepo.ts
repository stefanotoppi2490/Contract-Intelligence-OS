import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createUser(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findManyUsers(args?: Prisma.UserFindManyArgs) {
  return prisma.user.findMany(args ?? {});
}

export function updateUser(id: string, data: Prisma.UserUpdateInput) {
  return prisma.user.update({ where: { id }, data });
}

export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
