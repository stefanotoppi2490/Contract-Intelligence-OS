import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "text/plain",
] as const;

export const documentSourceSchema = z.enum(["UPLOAD", "INTEGRATION"]);

export const attachDocumentSchema = z.object({
  originalName: z.string().min(1, "Original name is required").max(500),
  mimeType: z
    .string()
    .refine((v) => ALLOWED_MIME_TYPES.includes(v as (typeof ALLOWED_MIME_TYPES)[number]), {
      message: "Allowed types: pdf, docx, txt",
    }),
  size: z.number().int().nonnegative().optional(),
  storageKey: z.string().max(1000).optional(),
  source: documentSourceSchema.default("UPLOAD"),
});

export type AttachDocumentInput = z.infer<typeof attachDocumentSchema>;

export const extractTextQuerySchema = z.object({
  force: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const getTextQuerySchema = z.object({
  limit: z.coerce.number().int().min(0).max(100_000).optional().default(2000),
});

export const textResponseSchema = z.object({
  status: z.enum(["TEXT_READY", "ERROR"]),
  preview: z.string(),
  fullText: z.string().optional(),
  extractedAt: z.string().datetime().optional(),
  errorMessage: z.string().nullable().optional(),
  extractor: z.enum(["PDF", "DOCX", "TXT"]).optional(),
});
export type TextResponse = z.infer<typeof textResponseSchema>;
