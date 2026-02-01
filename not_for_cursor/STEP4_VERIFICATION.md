# STEP 4: Manual verification checklist

## Prerequisites

- `pnpm db:migrate` applied (migration `step4_blob_text_extraction`).
- For real uploads: set `BLOB_READ_WRITE_TOKEN` (Vercel Blob). Without it, upload will return 502.
- Signed-in user with a workspace; role other than VIEWER for upload/extract.

---

## 1. Real file upload (Vercel Blob)

- [ ] Open a contract detail page (`/contracts/[id]`).
- [ ] For a version with no document: click **Upload file**, choose a PDF/DOCX/TXT (≤ 4 MB), click **Upload**.
  - With `BLOB_READ_WRITE_TOKEN`: document is created, ingestion status **UPLOADED**, blob URL in `storageKey`.
  - Without token: 502 with message about `BLOB_READ_WRITE_TOKEN`.
- [ ] Try uploading a second file for the same version: expect **409** and message "already has a document".
- [ ] As VIEWER: upload control should be absent or disabled; direct POST to `/api/.../upload` returns **403**.

---

## 2. Ingestion status

- [ ] After upload, document row shows **UPLOADED** (or badge).
- [ ] After successful text extraction, document shows **TEXT_READY**.
- [ ] After failed extraction (e.g. PDF with no text layer), document shows **ERROR** and error message.

---

## 3. Extract text

- [ ] With a document present, **Extract text** button is enabled (non-VIEWER).
- [ ] Click **Extract text**: loading state, then server runs extraction.
- [ ] TXT: extracted text matches file content; preview and "Show more" work.
- [ ] DOCX: non-empty text; preview and "Show more" work.
- [ ] PDF with text layer: **TEXT_READY**, preview and "Show more" work.
- [ ] PDF without text layer (image-only): **ERROR** with "OCR not implemented yet".
- [ ] As VIEWER: **Extract text** absent or disabled; POST to `/api/.../extract-text` returns **403**.
- [ ] Idempotency: run extract again without `?force=true` → same result, no re-extract when already TEXT_READY.
- [ ] After ERROR, run extract again (retry) → allowed.

---

## 4. Text preview and errors

- [ ] First ~500 chars shown as preview.
- [ ] **Show more** loads full text (GET `/api/.../text?limit=50000`) and expands; **Show less** collapses.
- [ ] Extraction errors (e.g. "OCR not implemented yet") shown clearly in the version card.

---

## 5. GET text API

- [ ] `GET /api/contracts/:id/versions/:versionId/text` returns `status`, `preview`, `extractedAt`, `errorMessage`, optional `fullText` (with limit).
- [ ] No document or no extraction: appropriate null/empty response.

---

## 6. Workspace scoping

- [ ] Contract from another workspace: 404 on upload, extract-text, and text.
- [ ] All routes use workspace from session; no cross-tenant access.

---

## Quick test (no Blob token)

1. Run app, go to contract detail.
2. Confirm **Upload file** is available for a version with no document.
3. Upload → expect 502 (no token) or 201 (with token).
4. If 502, set a placeholder or skip upload; use existing metadata-only document from STEP 3 for extract-text only if your flow allows (extract-text needs a document with a real `storageKey`; metadata-only has `pending://` and download will fail).
