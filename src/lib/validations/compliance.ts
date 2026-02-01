import { z } from "zod";

export const analyzeBodySchema = z.object({
  policyId: z.string().min(1, "policyId is required"),
});

export type AnalyzeBody = z.infer<typeof analyzeBodySchema>;
