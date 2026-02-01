import { z } from "zod";
import type { MemberRole } from "@prisma/client";

const memberRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "LEGAL",
  "RISK",
  "MEMBER",
  "VIEWER",
] as const satisfies readonly MemberRole[]);

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email"),
  role: memberRoleSchema.default("MEMBER"),
});

export const updateMemberSchema = z.object({
  role: memberRoleSchema,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
