Implement STEP 9A: Risk Aggregation & Deterministic Executive Summary (NO AI).

Context

- STEP 8C complete.
- ClauseExtraction (AI) exists but is NOT used here.
- ClauseFinding is deterministic and already includes:
  - clauseType
  - complianceStatus (COMPLIANT | VIOLATION | UNCLEAR | NOT_APPLICABLE | OVERRIDDEN)
  - severity
  - riskType
  - weight
  - confidence
  - recommendation
- ContractCompliance exists with:
  - rawScore
  - effectiveScore
  - status (COMPLIANT | NEEDS_REVIEW | NON_COMPLIANT)
- Exceptions can override findings.
- Ledger exists.

Goal
Add a deterministic “management-level” risk aggregation and executive summary layer
that:

1. Aggregates risk per category (riskType).
2. Produces an executive-friendly summary (deterministic, template-based).
3. Is exportable and visible in UI.
4. Does NOT change scoring, findings, or policy logic.

This step is a READ-ONLY AGGREGATION layer.

────────────────────────────────

1. RISK AGGREGATION MODEL (IN-MEMORY)
   ────────────────────────────────

Create types:
src/core/services/risk/riskAggregation.ts

export type RiskCluster = {
riskType: "LEGAL" | "FINANCIAL" | "OPERATIONAL" | "DATA" | "SECURITY";
level: "OK" | "NEEDS_REVIEW" | "MEDIUM" | "HIGH";
violationCount: number;
unclearCount: number;
overriddenCount: number;
maxSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
totalWeight: number;
topDrivers: Array<{
clauseType: string;
severity: string | null;
weight: number;
reason: string; // deterministic (from rule/recommendation)
}>;
};

export type RiskAggregation = {
contractId: string;
contractVersionId: string;
policyId: string;
overallStatus: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
rawScore: number;
effectiveScore: number;
clusters: RiskCluster[];
topDrivers: RiskCluster["topDrivers"]; // flattened, sorted by weight desc
generatedAt: string;
};

No Prisma table required (compute on the fly).

──────────────────────────────── 2) AGGREGATION LOGIC (DETERMINISTIC)
────────────────────────────────

Create:
src/core/services/risk/aggregateRisk.ts

Input:

- contractVersionId
- policyId

Load:

- ClauseFinding[] for the version + policy
- ContractCompliance for the version + policy

Aggregation rules:

For each riskType:

- violationCount = count findings with complianceStatus === VIOLATION
- unclearCount = count findings with complianceStatus === UNCLEAR
- overriddenCount = count findings with complianceStatus === OVERRIDDEN
- maxSeverity = highest severity among findings
- totalWeight = sum of weights for VIOLATION findings only
- topDrivers:
  - include only VIOLATION or UNCLEAR findings
  - sort by weight desc
  - max 3 per cluster

Cluster level rules:

- if any CRITICAL violation → HIGH
- else if violationCount > 0 → MEDIUM
- else if unclearCount > 0 → NEEDS_REVIEW
- else → OK

Overall status:

- if effectiveScore < 60 → NON_COMPLIANT
- else if any cluster.level in {HIGH, MEDIUM, NEEDS_REVIEW} → NEEDS_REVIEW
- else → COMPLIANT

──────────────────────────────── 3) EXECUTIVE SUMMARY (DETERMINISTIC TEXT)
────────────────────────────────

Create:
src/core/services/risk/executiveSummary.ts

Input:

- RiskAggregation

Output:
export type ExecutiveSummary = {
headline: string;
paragraphs: string[];
keyRisks: string[]; // bullets
recommendation: string;
};

Rules (template-based):

Headline:

- COMPLIANT → "Contract compliant with company standards."
- NEEDS_REVIEW → "Contract requires review before approval."
- NON_COMPLIANT → "Contract is not compliant with company standards."

Paragraph rules:

- Always mention overallStatus + effectiveScore.
- Mention top 1–2 risk clusters (by level then weight).

Key risks bullets:

- One bullet per top driver (max 3).

Recommendation:

- If NON_COMPLIANT → "Renegotiation or exception approval required."
- If NEEDS_REVIEW → "Legal or risk review recommended."
- If COMPLIANT → "Contract can proceed to approval."

NO AI.
NO randomness.

──────────────────────────────── 4) API
────────────────────────────────

Add:
GET /api/contracts/:id/versions/:versionId/risk-summary?policyId=...

- RBAC: VIEWER can read
- Validate workspace ownership
- Returns:
  {
  aggregation: RiskAggregation,
  summary: ExecutiveSummary
  }

──────────────────────────────── 5) UI
────────────────────────────────

A) Contract detail page (/contracts/[id])

For each analyzed version add a new section:
"Executive Risk Summary"

Show:

- Headline
- Overall score (effective/raw)
- Risk cluster table:
  - Risk type
  - Level badge
  - Violations / Unclear
- Key risks (bullets)
- Recommendation

This section is READ-ONLY.

B) Export

- Extend existing export (or add new button):
  “Export Executive Summary”
- PDF / HTML is fine (reuse existing export infra).
- This is management-facing (1–2 pages max).

──────────────────────────────── 6) LEDGER
────────────────────────────────

When executive summary is generated for export:

- Record LedgerEvent:
  type: REPORT_EXPORTED
  metadata:
  {
  "reportType": "EXECUTIVE_SUMMARY",
  "policyId": "...",
  "effectiveScore": 72
  }

──────────────────────────────── 7) TESTS
────────────────────────────────

- aggregateRisk:
  - correct cluster levels
  - violations vs unclear logic
- executiveSummary:
  - deterministic output for same input
  - headline matches overallStatus
- API:
  - workspace scoping
  - missing policyId → 400

──────────────────────────────── 8) MANUAL VERIFICATION CHECKLIST
────────────────────────────────

1. Analyze a contract with:
   - at least 1 VIOLATION
   - at least 1 UNCLEAR
2. Open contract detail.
3. See "Executive Risk Summary":
   - clusters visible
   - readable summary
4. Export executive summary.
5. Confirm PDF/HTML is readable by non-legal user.
6. Verify no score or finding changed.

Deliverables

- aggregateRisk service
- executiveSummary generator
- API route
- UI section
- export integration
- tests
