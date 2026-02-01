/**
 * Server-side text extraction: TXT, DOCX (mammoth), PDF (pdf-parse-debugging-disabled, Node-safe).
 * PDF with no text layer returns ERROR "OCR not implemented yet".
 */

import "server-only";

import mammoth from "mammoth";
import type { TextExtractor, TextStatus } from "@prisma/client";

export type ExtractResult =
  | { ok: true; text: string; extractor: TextExtractor; status: "TEXT_READY" }
  | { ok: false; extractor: TextExtractor; status: "ERROR"; errorMessage: string };

const PDF_NO_TEXT_MESSAGE = "OCR not implemented yet";

/** Extract text from buffer by mime type. */
export async function extractFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractResult> {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (
    normalized === "text/plain" ||
    normalized === "text/plain; charset=utf-8" ||
    normalized === "text/plain; charset=us-ascii"
  ) {
    return extractTxt(buffer);
  }
  if (
    normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=binary"
  ) {
    return extractDocx(buffer);
  }
  if (normalized === "application/pdf") {
    return extractPdf(buffer);
  }
  return {
    ok: false,
    extractor: "TXT",
    status: "ERROR",
    errorMessage: `Unsupported mime type: ${mimeType}`,
  };
}

function extractTxt(buffer: Buffer): ExtractResult {
  const text = buffer.toString("utf-8");
  return { ok: true, text, extractor: "TXT", status: "TEXT_READY" };
}

async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value ?? "";
    return { ok: true, text, extractor: "DOCX", status: "TEXT_READY" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, extractor: "DOCX", status: "ERROR", errorMessage: message };
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  try {
    const pdfParse = (await import("pdf-parse-debugging-disabled")).default;
    const res = await pdfParse(buffer);
    const text = (res.text ?? "").trim();
    if (text.length === 0) {
      return {
        ok: false,
        extractor: "PDF",
        status: "ERROR",
        errorMessage: PDF_NO_TEXT_MESSAGE,
      };
    }
    return { ok: true, text, extractor: "PDF", status: "TEXT_READY" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, extractor: "PDF", status: "ERROR", errorMessage: message };
  }
}

export function getExtractorFromMime(mimeType: string): TextExtractor {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalized === "application/pdf") return "PDF";
  if (
    normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCX";
  return "TXT";
}
