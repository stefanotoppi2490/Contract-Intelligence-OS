import { z } from "zod";

export const counterpartyTypeSchema = z.enum(["CUSTOMER", "VENDOR"]);

export const createCounterpartySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: counterpartyTypeSchema.default("CUSTOMER"),
  notes: z.string().max(2000).optional(),
});

export const updateCounterpartySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: counterpartyTypeSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateCounterpartyInput = z.infer<typeof createCounterpartySchema>;
export type UpdateCounterpartyInput = z.infer<typeof updateCounterpartySchema>;
