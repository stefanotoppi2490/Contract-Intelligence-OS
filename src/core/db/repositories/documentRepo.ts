import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createDocument(data: Prisma.DocumentCreateInput) {
  return prisma.document.create({ data });
}

export function findDocumentById(id: string) {
  return prisma.document.findUnique({ where: { id } });
}

export function findManyDocuments(args?: Prisma.DocumentFindManyArgs) {
  return prisma.document.findMany(args ?? {});
}

export function findManyDocumentsByContractVersion(
  contractVersionId: string,
  args?: Omit<Prisma.DocumentFindManyArgs, "where">
) {
  return prisma.document.findMany({
    ...args,
    where: { contractVersionId },
    orderBy: args?.orderBy ?? { createdAt: "desc" },
  });
}

export function updateDocument(id: string, data: Prisma.DocumentUpdateInput) {
  return prisma.document.update({ where: { id }, data });
}

export function deleteDocument(id: string) {
  return prisma.document.delete({ where: { id } });
}
