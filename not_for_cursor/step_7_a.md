Add PDF export to STEP 7 without changing existing pages or HTML export.

Current state:

- Version comparison pages already exist and work.
- HTML export already works.
- Do NOT refactor compare logic, UI pages, or existing HTML export.

Goal:
Add a real PDF export alongside the existing HTML export.

Requirements:

1. Keep existing HTML export exactly as-is.
2. Add PDF export as an additional option.

API change (minimal):

- Update existing POST /api/contracts/:id/compare/report
- Accept optional body param:
  { format?: "pdf" | "html" }
- Default behavior:
  - format === "html" → existing behavior (no changes)
  - format === "pdf" → NEW behavior:
    - generate PDF server-side
    - return binary PDF
    - headers:
      Content-Type: application/pdf
      Content-Disposition: attachment; filename="Contract_Compare_vX_vs_vY.pdf"

PDF generation:

- Use @react-pdf/renderer (Vercel-safe).
- Create new file ONLY:
  src/core/services/reports/versionComparePdf.tsx
  export async function buildComparePdf(result): Promise<Uint8Array>
- PDF content must match the existing HTML report structure:
  - contract title, policy
  - version summary + scores
  - delta improved/worsened
  - top drivers
  - changed clauses only

UI change (minimal):

- Keep existing “Export” (HTML).
- Add a second button near it:
  “Export PDF”
  → calls the same endpoint with { format: "pdf" }.
- No layout changes, no page restructuring.

Tests:

- Add ONE test:
  - format="pdf" returns Content-Type application/pdf and non-empty body.
- Do not touch existing HTML export tests.

Constraints:

- Do not remove or rewrite HTML export.
- Do not introduce new pages.
- Do not refactor compare logic.
- Keep changes minimal and isolated.

Deliverable:

- PDF export works in addition to existing HTML export.
