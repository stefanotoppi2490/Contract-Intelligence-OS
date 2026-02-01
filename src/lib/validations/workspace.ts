import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export const selectWorkspaceSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type SelectWorkspaceInput = z.infer<typeof selectWorkspaceSchema>;
