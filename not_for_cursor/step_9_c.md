Implement STEP 9C: Executive Export Pack (PDF + HTML/MD) for the Executive Risk Summary.

Context
• STEP 9A exists: deterministic risk aggregation + executive summary data (per policy, per contract/version).
• STEP 9B exists: AI narrative generated from structured risk data (regeneratable).
• We already have exports in STEP7 (compare report) with HTML and PDF support (likely using @react-pdf/renderer or equivalent).
• Must remain audit-safe:
• scoring and compliance are deterministic
• AI is ONLY used for narrative text (optional)

Goal

Add a single, management-ready export for the Executive Risk Summary page:
• PDF (primary)
• HTML and Markdown (secondary, downloadable)
Export must include:

    1.	Contract metadata (title, counterparty, contractType, version, dates)
    2.	Contract decision headline (COMPLIANT / NEEDS_REVIEW / NON_COMPLIANT)
    3.	Score (raw + effective)
    4.	Risk clusters table (riskType -> level, violations, unclear)
    5.	Key risks list (top 5 drivers, deterministic)
    6.	Approved exceptions snapshot (if any) — counts + list (optional but nice)
    7.	AI narrative (if present) with label “AI-generated narrative (from structured risk data)”
    8.	Footer: generatedAt, workspace, policy name

Constraints
• Workspace scoped + RBAC enforced
• VIEWER can download HTML/MD, but PDF export only for LEGAL/RISK/ADMIN (or same rule you used in STEP7).
• Do NOT change scoring logic.
• Do NOT introduce new migrations unless strictly needed.
• Avoid N+1 queries (use one server query that returns everything required).

⸻

1. API

Add endpoints

GET /api/contracts/:id/executive-summary?policyId=...&versionId=...
• returns a normalized “export-ready” object:
• contract info
• selected version info
• summary (score, decision, clusters, keyRisks)
• narrative (string | null)
• exceptions summary (optional)
• RBAC: VIEWER can read

POST /api/contracts/:id/executive-summary/export
Body:

{
"policyId": "…",
"versionId": "…",
"format": "pdf" | "html" | "md",
"includeNarrative": true | false
}

    •	For pdf: return application/pdf streamed download
    •	For html: return text/html
    •	For md: return text/markdown
    •	RBAC:
    •	html/md: any authenticated workspace member (VIEWER allowed)
    •	pdf: LEGAL/RISK/ADMIN only (or consistent with STEP7)

Ledger

Record LedgerEventType (if already added in enum) OR reuse existing:
• If you already have a generic export event type: use it.
• Otherwise do NOT add new enum values now (avoid migration pain).
• Instead: record POLICY_RULE_UPDATED etc is irrelevant — add a LedgerEvent with:
• type: ANALYSIS_RUN (or another existing safe type) is wrong.
• Prefer: add metadata.action = "EXECUTIVE_EXPORT" and keep type = "REPORT_EXPORTED" only if enum exists.
If no suitable type exists, log with the closest existing OR skip ledger for MVP.
(Prefer logging if you already have something like REPORT_EXPORTED.)

⸻

2. Report builder service

Create:
src/core/services/reports/executiveSummaryReport.ts

Exports:

export type ExecutiveExportModel = { ... };

export function buildExecutiveMarkdown(model: ExecutiveExportModel): string;
export function buildExecutiveHtml(model: ExecutiveExportModel): string;
export async function buildExecutivePdf(model: ExecutiveExportModel): Promise<Uint8Array | Buffer>;

PDF implementation
• Reuse the same PDF stack used in STEP7 (DO NOT introduce a second library).
• If STEP7 uses @react-pdf/renderer, implement a new PDF component:
• ExecutiveSummaryPdf.tsx
• Layout: 1–2 pages max, clean, “board-ready”.

PDF sections order:
• Title + subtitle (contract, policy)
• Decision headline + effective score
• Risk clusters table
• Key risks bullets
• Exceptions snapshot (optional)
• AI narrative block (optional)
• Footer

⸻

3. UI changes

On the Executive Risk Summary UI (where you have dropdown policy + export button already):
• Replace/extend current export:
• Dropdown “Export format”: PDF / HTML / Markdown
• Checkbox: “Include AI narrative”
• Button “Export Executive Summary”
• On click:
• call POST export endpoint
• trigger browser download with correct filename:
• ExecutiveSummary*<contractTitle>\_v<version>*<policy>.pdf
• Show visible success/error states.

⸻

4. Contract detail integration (optional but recommended)

In /contracts/[id] compliance section:
• add small link:
• “Open Executive Summary”
• goes to /contracts/[id]/executive?versionId=…&policyId=…
(if page exists already, just add link; otherwise skip)

⸻

5. Tests (Vitest)

Add tests: 1. executiveSummaryReport.test.ts

    •	markdown contains: contract title, score, decision
    •	html contains: key risks items

    2.	export/route.test.ts

    •	VIEWER can export html/md (200)
    •	VIEWER cannot export pdf (403)
    •	LEGAL/RISK/ADMIN can export pdf (200, content-type pdf)

    3.	Ensure export does not change DB state except optional ledger event.

⸻

6. Manual verification checklist
   1. Open contract → Executive Risk Summary
   2. Select policy and version (if selectable)
   3. Export:
      • HTML downloads and opens in browser
      • MD downloads
      • PDF downloads and is readable (1–2 pages)
   4. Toggle “Include AI narrative”:
      • ON: narrative appears with label “AI-generated”
      • OFF: narrative section hidden
   5. Login as VIEWER:
      • export html/md works
      • export pdf forbidden
   6. Verify no scoring changes after export.

⸻

Deliverables
• API endpoints (GET model + POST export)
• executiveSummaryReport builder (md/html/pdf)
• UI export controls + download behavior
• tests + manual checklist
• (optional) ledger export event metadata

Important: Do not refactor existing scoring/compliance. Only read existing computed structures and generate exports.

⸻
