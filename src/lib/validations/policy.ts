import { z } from "zod";

export const createPolicySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
