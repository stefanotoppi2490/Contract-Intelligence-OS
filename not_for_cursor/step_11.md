Implement STEP 11: Deal Desk Mode (premium) end-to-end.

Context
• We already have: Contracts, Versions, Documents upload + text extraction, ClauseExtraction (AI), ClauseFindings, ContractCompliance (raw/effective), Exceptions workflow, Ledger events.
• STEP 7 compare exists (vA vs vB risk delta + export).
• STEP 9 provides executive risk summary + AI narrative generation from structured risk data.
• STEP 10 provides Portfolio Risk Dashboard.

Goal
Create a “Deal Desk” workflow for a single contract version under a selected policy: 1. Combine analysis + exceptions + compare + executive narrative into a single decision view. 2. Produce a deterministic decision recommendation: GO / NO-GO / NEEDS_REVIEW (no AI for the decision). 3. Allow legal/risk/admin to “approve” a final decision record with audit trail. 4. Export a management-ready Deal Desk report (PDF + HTML).

Non-goals
• Do NOT change core scoring rules.
• AI can generate narrative text, but decision logic must be deterministic.

──────────────────────────────── 1. Prisma models
────────────────────────────────

Add enums:
DealDecisionStatus: DRAFT | FINAL
DealDecisionOutcome: GO | NO_GO | NEEDS_REVIEW

Add model DealDecision:
• id
• workspaceId
• contractId
• contractVersionId
• policyId
• status DealDecisionStatus (default DRAFT)
• outcome DealDecisionOutcome
• rationale Text (deterministic explanation + key drivers)
• executiveSummary Text (can be AI-generated from structured data; optional)
• createdByUserId
• finalizedByUserId (nullable)
• finalizedAt (nullable)
• createdAt
• updatedAt

Constraints:
• @@unique([contractVersionId, policyId]) // one decision per version+policy

Migrations allowed.

──────────────────────────────── 2) Deterministic decision engine
────────────────────────────────

Create:
src/core/services/dealDesk/dealDecisionEngine.ts

Input:
• contractVersionId
• policyId

Load:
• compliance (raw/effective score, status)
• findings (policy rules) including:
• complianceStatus (VIOLATION/UNCLEAR/COMPLIANT/NOT_APPLICABLE)
• severity, riskType, weight, recommendation
• overridden flag (approved exception linked)
• exceptions:
• open exceptions count (REQUESTED)
• approved exceptions count
• optional: latest comparison vs previous version (if exists) to show trend (but decision must not require compare)

Decision logic (deterministic, must be reproducible):
• Let effectiveScore = compliance.effectiveScore
• Let violations = count findings where status==VIOLATION and not overridden
• Let criticalViolations = count findings where severity==CRITICAL and status==VIOLATION and not overridden
• Let unclear = count findings where status==UNCLEAR
• Let openExceptions = count exceptions with status==REQUESTED
Rules:

    1.	If criticalViolations > 0 → outcome = NO_GO
    2.	Else if effectiveScore < 60 → outcome = NO_GO
    3.	Else if violations > 0 → outcome = NEEDS_REVIEW
    4.	Else if unclear > 0 → outcome = NEEDS_REVIEW
    5.	Else if openExceptions > 0 → outcome = NEEDS_REVIEW
    6.	Else → outcome = GO

Rationale builder (deterministic):
• Provide bullet reasons:
• “Effective score: 72/100”
• “Violations: 1 (FINANCIAL: LIABILITY)”
• “Unclear: 2 (LEGAL: CONFIDENTIALITY, DATA: DATA_PRIVACY)”
• “Approved exceptions: 1”
• “Open exception requests: 1”
• Include top 5 drivers:
• highest weights among violations/unclear
• Include riskType clustering summary (reuse STEP 9 aggregation)

Output:
type DealDecisionPreview = {
contractId
contractVersionId
policyId
effectiveScore
rawScore
outcome
statusSuggestion: “DRAFT”
counts: { violations, criticalViolations, unclear, overridden, openExceptions, approvedExceptions }
topDrivers: Array<{ clauseType, riskType, severity, weight, status, recommendation }>
rationaleMarkdown: string
}

No AI calls here.

──────────────────────────────── 3) Ledger integration
────────────────────────────────

Add LedgerEventType values (if you prefer avoiding enum migration pain, store metadata with existing types; but best is new enum values now):
• DEAL_DECISION_DRAFTED
• DEAL_DECISION_FINALIZED
• DEAL_DESK_REPORT_EXPORTED

Record events:
• when decision saved (draft) → DEAL_DECISION_DRAFTED
• when finalized → DEAL_DECISION_FINALIZED
• when exporting report → DEAL_DESK_REPORT_EXPORTED

Include metadata:
• outcome, effectiveScore, violations/unclear counts, policyId

──────────────────────────────── 4) API routes
────────────────────────────────

All workspace-scoped, RBAC enforced.

A) GET /api/contracts/:id/versions/:versionId/deal-desk?policyId=…
RBAC: VIEWER can read
Returns:
• deal decision preview (computed)
• existing DealDecision if exists (draft/final)
• compliance + findings + exceptions summary (for UI)

If missing analysis for that version/policy → 409 MISSING_ANALYSIS with details.

B) POST /api/contracts/:id/versions/:versionId/deal-desk/draft
Body: { policyId, executiveSummary? } // executiveSummary optional (AI-generated separately)
RBAC: LEGAL/RISK/ADMIN
Creates or updates DealDecision as DRAFT using engine output for outcome + rationale.
If user supplies executiveSummary store it.

C) POST /api/contracts/:id/versions/:versionId/deal-desk/finalize
Body: { policyId }
RBAC: LEGAL/RISK/ADMIN only
Sets status=FINAL, finalizedByUserId, finalizedAt.
Must be idempotent (finalizing twice returns existing).
If decision doesn’t exist yet, create from engine output then finalize.

D) POST /api/contracts/:id/versions/:versionId/deal-desk/narrative
Body: { policyId }
RBAC: LEGAL/RISK/ADMIN
Uses AI to generate executiveSummary text ONLY from structured data:
• compliance scores/status
• risk type aggregation
• key risks list (top drivers)
• exceptions summary
DO NOT pass raw contract text.
Returns generated narrative string; store on DealDecision (draft) optionally.

E) POST /api/contracts/:id/versions/:versionId/deal-desk/report
Body: { policyId, format: “pdf”|“html” }
RBAC: LEGAL/RISK/ADMIN
Generates management-ready report from structured data + decision record:
• if DealDecision exists use it; else compute preview
Return downloadable file:
• pdf: application/pdf
• html: text/html

Zod validate all payloads.

──────────────────────────────── 5) UI: Deal Desk page
────────────────────────────────

Add route:
A) /contracts/[id]/deal-desk?versionId=…&policyId=…

Entry points:
• On contract detail page, per version add button “Deal Desk”.
• On compare page, add shortcut “Open Deal Desk for v2”.

UI layout (single page, exec-friendly): 1. Header: Contract title + counterparty + version number + policy selector 2. “Decision” card:
• Outcome badge: GO / NO-GO / NEEDS_REVIEW
• Effective score + status
• Counts (Violations, Unclear, Overridden, Open exceptions) 3. “Key risks” (top drivers list) 4. “Exceptions” panel:
• open requests + approved list with links 5. “Comparison” panel (if previous version exists):
• link to compare page, show delta improved/worsened (optional) 6. “Executive Narrative (AI-generated)” box:
• Button “Generate narrative”
• Shows narrative text
• Disclaimer: “Generated from structured risk data” 7. Actions:
• “Save Draft”
• “Finalize decision”
• “Export report (PDF)”
• “Export report (HTML)”

RBAC:
• VIEWER can view but buttons disabled (draft/finalize/generate/export)
• LEGAL/RISK/ADMIN can do actions

Show clear empty states:
• Missing analysis → show “Analyze contract first” link to contract detail
• Missing extractions (optional) → still ok if findings exist

──────────────────────────────── 6) Report generator
────────────────────────────────

Create:
src/core/services/reports/dealDeskReport.ts

Functions:
• buildDealDeskHtml(payload): string
• buildDealDeskPdf(payload): Buffer (use same PDF approach as STEP 7)

Report sections:
• Contract + policy + version
• Decision outcome + effective score
• Risk table by riskType (violations/unclear/overridden)
• Key risks list with recommendations
• Exceptions summary (approved + open)
• Optional narrative section (if present)
• Footer: workspace + generated at

Ensure “management-ready” formatting.

──────────────────────────────── 7) Tests
────────────────────────────────

Unit tests:
• dealDecisionEngine:
• critical violation => NO_GO
• effectiveScore < 60 => NO_GO
• violations >0 => NEEDS_REVIEW
• unclear >0 => NEEDS_REVIEW
• openExceptions >0 => NEEDS_REVIEW
• else GO
• overridden violations don’t count
API tests:
• VIEWER cannot draft/finalize/export (403)
• workspace scoping enforced
• finalize is idempotent
• narrative endpoint does not include contract raw text (validate prompt input source is structured-only)
Report tests:
• html/pdf generation returns non-empty output and includes outcome/score

──────────────────────────────── 8) Manual verification checklist
──────────────────────────────── 1. Analyze a contract version with at least 1 violation and 1 unclear. 2. Open Deal Desk:
• Outcome should be NEEDS_REVIEW or NO_GO based on rules 3. Create an exception and approve it:
• overridden count increases, effective score may increase
• outcome may change deterministically 4. Generate narrative:
• should mention score, categories, key risks 5. Save draft then finalize:
• status becomes FINAL, ledger shows events 6. Export PDF/HTML and verify content. 7. VIEWER: can view page but cannot click actions.

Deliverables
• Prisma migration (DealDecision + enums)
• dealDecisionEngine service
• Deal Desk API routes + zod
• UI page + entry points
• Report generator (PDF + HTML)
• Ledger events for actions
• Tests + manual checklist
