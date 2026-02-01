/**
 * Type declaration for pdf-parse-debugging-disabled (same API as pdf-parse v1, debug block disabled).
 */
declare module "pdf-parse-debugging-disabled" {
  interface PdfParseResult {
    text?: string;
    numpages?: number;
    info?: unknown;
  }
  function pdfParse(data: Buffer, options?: unknown): Promise<PdfParseResult>;
  export default pdfParse;
}
