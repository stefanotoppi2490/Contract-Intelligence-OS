import { z } from "zod";

export const contractTypeSchema = z.enum(["NDA", "MSA", "SOW", "SLA", "OTHER"]);
export const contractStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "SIGNED", "ARCHIVED"]);

export const createContractSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  contractType: contractTypeSchema.optional(),
  counterpartyId: z.string().min(1, "Counterparty is required"),
  status: contractStatusSchema.default("DRAFT"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateContractSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  contractType: contractTypeSchema.optional().nullable(),
  counterpartyId: z.string().min(1).optional(),
  status: contractStatusSchema.optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const listContractsQuerySchema = z.object({
  status: contractStatusSchema.optional(),
  contractType: contractTypeSchema.optional(),
  counterpartyId: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
