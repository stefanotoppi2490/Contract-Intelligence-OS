Implement STEP 4: Real file upload (Vercel Blob) + text extraction pipeline + ingestion status.

Context:

- STEP 3 complete: contracts, versions, document metadata, 1 main document per version enforced (409 if already exists).
- Next.js App Router on Vercel.
- Prisma has Document; migrations allowed.

Requirements:

1. Storage (real upload):

- Use Vercel Blob.
- Implement POST /api/contracts/:id/versions/:versionId/upload:
  - Accept a file upload (multipart) OR use @vercel/blob/client upload then confirm server-side.
  - Enforce RBAC: VIEWER cannot upload.
  - Enforce workspace scoping (contract/version must belong to current workspace).
  - Enforce "1 main document per contractVersion": if exists -> return 409.
  - Persist Document fields:
    - originalName, mimeType, size
    - storageKey = blob URL (preferred)
    - source = UPLOAD
    - (optional but recommended) ingestionStatus enum: UPLOADED|TEXT_READY|ERROR and lastError.

2. Text model (separate table preferred):

- Add ContractVersionText table linked to ContractVersion with:
  - contractVersionId (unique)
  - text (long)
  - extractedAt
  - extractor enum: pdf|docx|txt
  - status enum: TEXT_READY|ERROR
  - errorMessage optional

3. Extraction (server-side only):

- POST /api/contracts/:id/versions/:versionId/extract-text:
  - RBAC: VIEWER cannot extract.
  - Fetch the main Document for the version, download from storageKey (blob URL).
  - TXT: buffer -> utf-8 string
  - DOCX: use mammoth to extract raw text
  - PDF: attempt text extraction (pdf-parse or similar). If extracted text is empty, save ERROR with message "OCR not implemented yet".
  - Save ContractVersionText and update Document.ingestionStatus if present.
  - Idempotency:
    - If existing ContractVersionText is TEXT_READY, return it without re-extract unless force=true is provided.
    - If ERROR, allow retry.

- GET /api/contracts/:id/versions/:versionId/text:
  - Return status + preview + extractedAt + errorMessage (and optionally full text with a safe size limit).

4. UI:

- Update /contracts/[id] version cards:
  - Upload real file (not metadata-only)
  - Show ingestion status (UPLOADED/TEXT_READY/ERROR)
  - Button "Extract text" (disabled unless a document exists; show loading)
  - Preview extracted text: first N chars with "Show more" (collapsible)
  - Show extraction errors clearly.

5. Security & quality:

- Workspace scoping everywhere.
- Zod validation everywhere.
- No direct Prisma in route handlers (use repositories/services).
- Tests:
  - uploading second doc returns 409
  - txt extraction returns exact content
  - docx extraction returns non-empty text
  - pdf extraction returns TEXT_READY or ERROR (if no text layer)
  - VIEWER cannot upload/extract (403)

Deliverables:

- prisma migration
- storage service wrapper (upload + download)
- API routes + Zod schemas
- UI updates
- tests
- manual verification checklist
