/**
 * STEP 8A: Repository for neutral AI clause extractions (no policy).
 */

import { prisma } from "../prisma";
import type { ClauseTaxonomy } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type ClauseExtractionCreate = {
  clauseType: ClauseTaxonomy;
  extractedValue: Prisma.InputJsonValue;
  extractedText: string | null;
  confidence: number;
  sourceLocation?: Prisma.InputJsonValue | null;
};

export function findManyByContractVersion(contractVersionId: string) {
  return prisma.clauseExtraction.findMany({
    where: { contractVersionId },
    orderBy: { clauseType: "asc" },
  });
}

/**
 * Replace all extractions for a version with the given list.
 * Uses transaction: delete existing then create new.
 */
export function replaceExtractionsForVersion(
  workspaceId: string,
  contractId: string,
  contractVersionId: string,
  extractions: ClauseExtractionCreate[]
) {
  return prisma.$transaction(async (tx) => {
    await tx.clauseExtraction.deleteMany({ where: { contractVersionId } });
    if (extractions.length === 0) return [];
    await tx.clauseExtraction.createMany({
      data: extractions.map((e) => ({
        workspaceId,
        contractId,
        contractVersionId,
        clauseType: e.clauseType,
        extractedValue: e.extractedValue ?? Prisma.JsonNull,
        extractedText: e.extractedText ?? null,
        confidence: Math.max(0, Math.min(1, e.confidence)),
        sourceLocation: e.sourceLocation ?? undefined,
        extractedBy: "AI",
      })),
    });
    return tx.clauseExtraction.findMany({
      where: { contractVersionId },
      orderBy: { clauseType: "asc" },
    });
  });
}
