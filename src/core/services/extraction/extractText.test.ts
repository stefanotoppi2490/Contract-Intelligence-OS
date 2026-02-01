import { describe, it, expect } from "vitest";
import { extractFromBuffer, getExtractorFromMime } from "./extractText";

describe("extractText", () => {
  describe("extractFromBuffer", () => {
    it("txt extraction returns exact content", async () => {
      const content = "Hello, World!\n\nContract terms here.";
      const buffer = Buffer.from(content, "utf-8");
      const result = await extractFromBuffer(buffer, "text/plain");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.text).toBe(content);
        expect(result.extractor).toBe("TXT");
        expect(result.status).toBe("TEXT_READY");
      }
    });

    it("docx extraction returns non-empty text or ERROR for invalid docx", async () => {
      // Minimal zip-like buffer; mammoth will fail with "Could not find main document part" for invalid docx
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip header
      const result = await extractFromBuffer(
        buffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(result.extractor).toBe("DOCX");
      if (result.ok) {
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.status).toBe("TEXT_READY");
      } else {
        expect(result.status).toBe("ERROR");
        expect(result.errorMessage).toBeDefined();
      }
    });

    it("pdf extraction returns TEXT_READY or ERROR and does not crash (pdf-parse v1, Node-safe)", async () => {
      // Minimal PDF: pdf-parse v1 may return empty text (ERROR "OCR not implemented yet") or some text (TEXT_READY)
      const minimalPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n178\n%%EOF"
      );
      const result = await extractFromBuffer(minimalPdf, "application/pdf");
      expect(result.extractor).toBe("PDF");
      expect(result.status === "TEXT_READY" || result.status === "ERROR").toBe(true);
      if (result.ok) {
        expect(typeof result.text).toBe("string");
      } else {
        expect(result.errorMessage).toBeDefined();
        if (result.errorMessage?.includes("OCR")) {
          expect(result.errorMessage).toContain("OCR");
        }
      }
    });
  });

  describe("getExtractorFromMime", () => {
    it("returns PDF for application/pdf", () => {
      expect(getExtractorFromMime("application/pdf")).toBe("PDF");
    });
    it("returns DOCX for docx mime", () => {
      expect(
        getExtractorFromMime(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe("DOCX");
    });
    it("returns TXT for text/plain", () => {
      expect(getExtractorFromMime("text/plain")).toBe("TXT");
    });
  });
});
