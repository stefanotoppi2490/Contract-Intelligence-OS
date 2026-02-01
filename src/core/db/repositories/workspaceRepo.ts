import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createWorkspace(data: Prisma.WorkspaceCreateInput) {
  return prisma.workspace.create({ data });
}

export function findWorkspaceById(id: string) {
  return prisma.workspace.findUnique({ where: { id } });
}

export function findManyWorkspaces(args?: Prisma.WorkspaceFindManyArgs) {
  return prisma.workspace.findMany(args ?? {});
}

export function updateWorkspace(id: string, data: Prisma.WorkspaceUpdateInput) {
  return prisma.workspace.update({ where: { id }, data });
}

export function deleteWorkspace(id: string) {
  return prisma.workspace.delete({ where: { id } });
}
