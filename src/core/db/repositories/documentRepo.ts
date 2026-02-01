import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export function createDocument(data: Prisma.DocumentCreateInput) {
  return prisma.document.create({ data });
}

/** Attach document metadata to a contract version (MVP: no blob, placeholder storageKey). */
export function attachDocumentToVersion(
  contractVersionId: string,
  data: {
    originalName: string;
    mimeType?: string | null;
    size?: number | null;
    storageKey?: string | null;
    source?: "UPLOAD" | "INTEGRATION";
  }
) {
  return prisma.document.create({
    data: {
      contractVersionId,
      originalName: data.originalName,
      fileName: data.originalName,
      mimeType: data.mimeType ?? undefined,
      size: data.size ?? undefined,
      storageKey: data.storageKey ?? undefined,
      source: data.source ?? "UPLOAD",
    },
  });
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

/** Count documents for a version (MVP: one main document per version). */
export function countDocumentsByContractVersion(contractVersionId: string): Promise<number> {
  return prisma.document.count({
    where: { contractVersionId },
  });
}

export function updateDocument(id: string, data: Prisma.DocumentUpdateInput) {
  return prisma.document.update({ where: { id }, data });
}

export function deleteDocument(id: string) {
  return prisma.document.delete({ where: { id } });
}
