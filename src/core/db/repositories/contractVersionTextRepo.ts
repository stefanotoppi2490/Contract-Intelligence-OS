import { prisma } from "../prisma";
import type { TextExtractor, TextStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export function createContractVersionText(data: Prisma.ContractVersionTextCreateInput) {
  return prisma.contractVersionText.create({ data });
}

export function findContractVersionTextByVersionId(contractVersionId: string) {
  return prisma.contractVersionText.findUnique({
    where: { contractVersionId },
  });
}

export function upsertContractVersionText(
  contractVersionId: string,
  data: {
    text: string;
    extractor: TextExtractor;
    status: TextStatus;
    errorMessage?: string | null;
  }
) {
  return prisma.contractVersionText.upsert({
    where: { contractVersionId },
    create: {
      contractVersionId,
      text: data.text,
      extractor: data.extractor,
      status: data.status,
      errorMessage: data.errorMessage ?? undefined,
    },
    update: {
      text: data.text,
      extractor: data.extractor,
      status: data.status,
      errorMessage: data.errorMessage ?? undefined,
      extractedAt: new Date(),
    },
  });
}

export function updateContractVersionText(
  id: string,
  data: Prisma.ContractVersionTextUpdateInput
) {
  return prisma.contractVersionText.update({ where: { id }, data });
}
