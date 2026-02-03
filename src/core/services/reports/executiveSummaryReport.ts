/**
 * STEP 9C: Executive Summary export (MD / HTML / PDF). Export-ready model and builders.
 * Uses deterministic data only; narrative is optional AI-generated text.
 */

export type ExecutiveExportCluster = {
  riskType: string;
  level: string;
  violations: number;
  unclear: number;
};

export type ExecutiveExportException = {
  id: string;
  title: string;
};

export type ExecutiveExportModel = {
  contractTitle: string;
  counterpartyName: string;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  versionNumber: number;
  policyName: string;
  decision: string;
  overallStatus: string;
  rawScore: number;
  effectiveScore: number;
  clusters: ExecutiveExportCluster[];
  keyRisks: string[];
  exceptions: { count: number; items: ExecutiveExportException[] };
  narrative: string | null;
  generatedAt: string;
  workspaceName: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExecutiveMarkdown(model: ExecutiveExportModel): string {
  const lines: string[] = [];
  lines.push(`# Executive Risk Summary`);
  lines.push("");
  lines.push(`**Contract:** ${model.contractTitle}`);
  lines.push(`**Counterparty:** ${model.counterpartyName}`);
  if (model.contractType) lines.push(`**Type:** ${model.contractType}`);
  lines.push(`**Version:** v${model.versionNumber}`);
  lines.push(`**Policy:** ${model.policyName}`);
  if (model.startDate) lines.push(`**Start:** ${model.startDate}`);
  if (model.endDate) lines.push(`**End:** ${model.endDate}`);
  lines.push("");
  lines.push(`## ${model.decision}`);
  lines.push("");
  lines.push(`Score: **${model.effectiveScore}/100** (raw ${model.rawScore})`);
  lines.push("");
  lines.push("### Risk clusters");
  lines.push("");
  lines.push("| Risk type | Level | Violations | Unclear |");
  lines.push("|-----------|-------|-------------|---------|");
  for (const c of model.clusters) {
    lines.push(`| ${c.riskType} | ${c.level} | ${c.violations} | ${c.unclear} |`);
  }
  lines.push("");
  if (model.keyRisks.length > 0) {
    lines.push("### Key risks");
    lines.push("");
    for (const k of model.keyRisks) {
      lines.push(`- ${k}`);
    }
    lines.push("");
  }
  if (model.exceptions.count > 0) {
    lines.push("### Approved exceptions");
    lines.push("");
    for (const e of model.exceptions.items) {
      lines.push(`- ${e.title}`);
    }
    lines.push("");
  }
  if (model.narrative) {
    lines.push("### AI-generated narrative (from structured risk data)");
    lines.push("");
    lines.push(model.narrative);
    lines.push("");
  }
  lines.push("---");
  lines.push(`Generated: ${model.generatedAt} · ${model.workspaceName} · ${model.policyName}`);
  return lines.join("\n");
}

export function buildExecutiveHtml(model: ExecutiveExportModel): string {
  const sections: string[] = [];
  sections.push(`<h1>Executive Risk Summary</h1>`);
  sections.push(`<p><strong>Contract:</strong> ${esc(model.contractTitle)}</p>`);
  sections.push(`<p><strong>Counterparty:</strong> ${esc(model.counterpartyName)}</p>`);
  if (model.contractType) sections.push(`<p><strong>Type:</strong> ${esc(model.contractType)}</p>`);
  sections.push(`<p><strong>Version:</strong> v${model.versionNumber}</p>`);
  sections.push(`<p><strong>Policy:</strong> ${esc(model.policyName)}</p>`);
  if (model.startDate) sections.push(`<p><strong>Start:</strong> ${esc(model.startDate)}</p>`);
  if (model.endDate) sections.push(`<p><strong>End:</strong> ${esc(model.endDate)}</p>`);
  sections.push(`<h2>${esc(model.decision)}</h2>`);
  sections.push(
    `<p>Score: <strong>${model.effectiveScore}/100</strong> (raw ${model.rawScore})</p>`
  );
  sections.push(`<h3>Risk clusters</h3>`);
  sections.push(`<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">`);
  sections.push(`<tr><th>Risk type</th><th>Level</th><th>Violations</th><th>Unclear</th></tr>`);
  for (const c of model.clusters) {
    sections.push(
      `<tr><td>${esc(c.riskType)}</td><td>${esc(c.level)}</td><td>${c.violations}</td><td>${c.unclear}</td></tr>`
    );
  }
  sections.push(`</table>`);
  if (model.keyRisks.length > 0) {
    sections.push(`<h3>Key risks</h3><ul>`);
    for (const k of model.keyRisks) {
      sections.push(`<li>${esc(k)}</li>`);
    }
    sections.push(`</ul>`);
  }
  if (model.exceptions.count > 0) {
    sections.push(`<h3>Approved exceptions</h3><ul>`);
    for (const e of model.exceptions.items) {
      sections.push(`<li>${esc(e.title)}</li>`);
    }
    sections.push(`</ul>`);
  }
  if (model.narrative) {
    sections.push(`<h3>AI-generated narrative (from structured risk data)</h3>`);
    sections.push(`<p>${esc(model.narrative).replace(/\n/g, "<br />")}</p>`);
  }
  sections.push(
    `<p style="margin-top:2em; font-size:0.9em; color:#666">Generated: ${esc(model.generatedAt)} · ${esc(model.workspaceName)} · ${esc(model.policyName)}</p>`
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Executive Summary: ${esc(model.contractTitle)}</title>
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

export async function buildExecutivePdf(model: ExecutiveExportModel): Promise<Uint8Array> {
  const { buildExecutivePdfBuffer } = await import("./ExecutiveSummaryPdf.js");
  return buildExecutivePdfBuffer(model);
}
