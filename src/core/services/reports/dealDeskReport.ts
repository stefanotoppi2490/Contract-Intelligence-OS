/**
 * STEP 11: Deal Desk report (HTML + PDF). Management-ready from structured data + decision record.
 */

export type DealDeskReportPayload = {
  contractTitle: string;
  counterpartyName: string;
  versionNumber: number;
  policyName: string;
  outcome: string;
  effectiveScore: number;
  rawScore: number;
  rationale: string;
  counts: {
    violations: number;
    criticalViolations: number;
    unclear: number;
    overridden: number;
    openExceptions: number;
    approvedExceptions: number;
  };
  riskByType: Array<{ riskType: string; violations: number; unclear: number }>;
  topDrivers: Array<{
    clauseType: string;
    riskType: string | null;
    severity: string | null;
    weight: number;
    recommendation: string | null;
  }>;
  approvedExceptions: Array<{ id: string; title: string }>;
  openExceptions: Array<{ id: string; title: string }>;
  narrative: string | null;
  generatedAt: string;
  workspaceName: string;
  status: string;
  finalizedAt: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDealDeskHtml(payload: DealDeskReportPayload): string {
  const sections: string[] = [];
  sections.push(`<h1>Deal Desk Report</h1>`);
  sections.push(`<p><strong>Contract:</strong> ${esc(payload.contractTitle)}</p>`);
  sections.push(`<p><strong>Counterparty:</strong> ${esc(payload.counterpartyName)}</p>`);
  sections.push(`<p><strong>Version:</strong> v${payload.versionNumber} · <strong>Policy:</strong> ${esc(payload.policyName)}</p>`);
  sections.push(`<h2>Decision: ${esc(payload.outcome)}</h2>`);
  sections.push(`<p>Status: ${esc(payload.status)}${payload.finalizedAt ? ` · Finalized: ${esc(payload.finalizedAt)}` : ""}</p>`);
  sections.push(`<p>Score: <strong>${payload.effectiveScore}/100</strong> (raw ${payload.rawScore})</p>`);
  sections.push(`<h3>Counts</h3>`);
  sections.push(
    `<p>Violations: ${payload.counts.violations} · Critical: ${payload.counts.criticalViolations} · Unclear: ${payload.counts.unclear} · Overridden: ${payload.counts.overridden} · Open exceptions: ${payload.counts.openExceptions} · Approved: ${payload.counts.approvedExceptions}</p>`
  );
  sections.push(`<h3>Rationale</h3>`);
  sections.push(`<pre style="white-space:pre-wrap; font-size:0.9em">${esc(payload.rationale)}</pre>`);
  if (payload.riskByType.length > 0) {
    sections.push(`<h3>Risk by type</h3>`);
    sections.push(`<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><tr><th>Risk type</th><th>Violations</th><th>Unclear</th></tr>`);
    for (const r of payload.riskByType) {
      sections.push(`<tr><td>${esc(r.riskType)}</td><td>${r.violations}</td><td>${r.unclear}</td></tr>`);
    }
    sections.push(`</table>`);
  }
  if (payload.topDrivers.length > 0) {
    sections.push(`<h3>Key risks</h3><ul>`);
    for (const d of payload.topDrivers) {
      sections.push(`<li>${esc(d.clauseType)} (${esc(d.riskType ?? "—")}): ${esc(d.recommendation ?? "—")}</li>`);
    }
    sections.push(`</ul>`);
  }
  if (payload.approvedExceptions.length > 0) {
    sections.push(`<h3>Approved exceptions</h3><ul>`);
    for (const e of payload.approvedExceptions) {
      sections.push(`<li>${esc(e.title)}</li>`);
    }
    sections.push(`</ul>`);
  }
  if (payload.openExceptions.length > 0) {
    sections.push(`<h3>Open exception requests</h3><ul>`);
    for (const e of payload.openExceptions) {
      sections.push(`<li>${esc(e.title)}</li>`);
    }
    sections.push(`</ul>`);
  }
  if (payload.narrative) {
    sections.push(`<h3>Executive narrative (AI-generated from structured data)</h3>`);
    sections.push(`<p>${esc(payload.narrative).replace(/\n/g, "<br />")}</p>`);
  }
  sections.push(
    `<p style="margin-top:2em; font-size:0.9em; color:#666">Generated: ${esc(payload.generatedAt)} · ${esc(payload.workspaceName)}</p>`
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Deal Desk: ${esc(payload.contractTitle)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2em auto; padding: 0 1em; }
    table { width: 100%; margin: 1em 0; }
    th { text-align: left; background: #f0f0f0; }
  </style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}

export async function buildDealDeskPdf(payload: DealDeskReportPayload): Promise<Uint8Array> {
  const { buildDealDeskPdfBuffer } = await import("./DealDeskPdf.js");
  return buildDealDeskPdfBuffer(payload);
}
