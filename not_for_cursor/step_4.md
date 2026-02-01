Implement STEP 4: Real file upload (Vercel Blob) + text extraction pipeline + ingestion status.

Context:

- STEP 3 complete: contracts, versions, document metadata, 1 main document per version enforced.
- Next.js App Router on Vercel.
- Prisma has Document; extend schema if needed (migrations ok).

Requirements:

1. Storage:
   - Use Vercel Blob for uploads.
   - Implement server route to upload file and store:
     - Document.originalName, mimeType, size
     - Document.storageKey = blob url or blob key (choose consistent)
     - Document.source = UPLOAD
   - Keep 1 main document per contractVersion (409 if exists).

2. Document text model:
   - Add a table ContractVersionText (or DocumentText) linked to ContractVersion (preferred) with:
     - text (large), extractedAt, extractor ("pdf"|"docx"|"txt"), status (TEXT_READY|ERROR), errorMessage?
   - Or store on ContractVersion as fields if schema already supports. Prefer separate table for cleanliness.

3. Extraction:
   - TXT: read buffer -> string
   - DOCX: use mammoth to extract raw text
   - PDF: attempt text extraction (pdf-parse or similar). If extraction yields empty, set status ERROR with message "OCR not implemented yet".
   - Must run server-side only.
   - Save extracted text and status.

4. API:
   - POST /api/contracts/:id/versions/:versionId/upload (multipart or upload via blob client + server confirm)
   - POST /api/contracts/:id/versions/:versionId/extract-text
   - GET /api/contracts/:id/versions/:versionId/text

5. UI:
   - On contract detail version card:
     - Upload file (real)
     - Show ingestion status
     - Button "Extract text"
     - Section "Preview text" (first N chars, expandable)
   - Handle errors and show them to user.

6. Security & quality:
   - RBAC: VIEWER cannot upload/extract.
   - Workspace scoping everywhere.
   - Tests:
     - uploading second doc returns 409 still
     - docx extraction returns non-empty text
     - txt extraction returns exact content
     - pdf extraction returns status (TEXT_READY or ERROR if no text)

Deliverables:

- prisma migration (new table/fields)
- storage service wrapper
- API routes + zod
- UI updates
- tests
- manual verification checklist
