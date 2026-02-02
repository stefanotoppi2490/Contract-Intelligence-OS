import { z } from "zod";

export const createExceptionSchema = z.object({
  clauseFindingId: z.string().min(1).optional().nullable(),
  policyId: z.string().min(1).optional().nullable(),
  title: z.string().min(1, "Title is required").max(500),
  justification: z.string().min(1, "Justification is required").max(5000),
});

export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;

export const decideExceptionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  decisionReason: z.string().max(2000).optional(),
});

export type DecideExceptionInput = z.infer<typeof decideExceptionSchema>;

export const exceptionListQuerySchema = z.object({
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
  contractId: z.string().cuid().optional(),
  policyId: z.string().cuid().optional(),
});

export type ExceptionListQuery = z.infer<typeof exceptionListQuerySchema>;
