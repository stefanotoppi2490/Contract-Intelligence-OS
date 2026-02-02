"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { VersionCompareResult, ChangeItem } from "@/core/services/compare/versionCompare";

type VersionOption = { id: string; versionNumber: number };
type PolicyOption = { id: string; name: string };

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function ChangeRow({
  change,
  fromVersionNumber,
  toVersionNumber,
}: {
  change: ChangeItem;
  fromVersionNumber: number;
  toVersionNumber: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const changeBadge =
    change.changeType === "ADDED"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : change.changeType === "REMOVED"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : change.changeType === "MODIFIED"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-muted text-muted-foreground";
  return (
    <>
      <tr className="border-b">
        <td className="p-2 font-mono text-sm">{change.clauseType}</td>
        <td className="p-2">
          <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${changeBadge}`}>
            {change.changeType}
          </span>
        </td>
        <td className="p-2 text-sm">
          {change.from ? (
            <>
              <span className={change.from.overridden ? "text-green-600 dark:text-green-400" : ""}>
                {change.from.status}
                {change.from.overridden ? " (overridden)" : ""}
              </span>
              {change.from.foundValue != null && (
                <span className="block text-muted-foreground truncate max-w-[12rem]" title={formatValue(change.from.foundValue)}>
                  {formatValue(change.from.foundValue).slice(0, 40)}
                  {(formatValue(change.from.foundValue).length > 40) ? "…" : ""}
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="p-2 text-sm">
          {change.to ? (
            <>
              <span className={change.to.overridden ? "text-green-600 dark:text-green-400" : ""}>
                {change.to.status}
                {change.to.overridden ? " (overridden)" : ""}
              </span>
              {change.to.foundValue != null && (
                <span className="block text-muted-foreground truncate max-w-[12rem]" title={formatValue(change.to.foundValue)}>
                  {formatValue(change.to.foundValue).slice(0, 40)}
                  {(formatValue(change.to.foundValue).length > 40) ? "…" : ""}
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="p-2 text-sm text-muted-foreground max-w-[14rem]">{change.why ?? "—"}</td>
        <td className="p-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setExpanded((x) => !x)}
          >
            {expanded ? "Hide" : "Details"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/30">
          <td colSpan={6} className="p-3 text-sm space-y-2">
            {change.recommendation && (
              <p><span className="font-medium text-muted-foreground">Recommendation:</span> {change.recommendation}</p>
            )}
            {change.from?.foundText && (
              <div>
                <span className="font-medium text-muted-foreground">v{fromVersionNumber} excerpt:</span>
                <blockquote className="mt-1 pl-2 border-l-2 text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                  {change.from.foundText}
                </blockquote>
              </div>
            )}
            {change.to?.foundText && (
              <div>
                <span className="font-medium text-muted-foreground">v{toVersionNumber} excerpt:</span>
                <blockquote className="mt-1 pl-2 border-l-2 text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                  {change.to.foundText}
                </blockquote>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function CompareClient({
  contractId,
  contractTitle,
  versions,
  policies,
  canExportReport,
}: {
  contractId: string;
  contractTitle: string;
  versions: VersionOption[];
  policies: PolicyOption[];
  canExportReport: boolean;
}) {
  const [fromVersionId, setFromVersionId] = useState("");
  const [toVersionId, setToVersionId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingVersionId, setMissingVersionId] = useState<string | null>(null);
  const [result, setResult] = useState<VersionCompareResult | null>(null);

  async function runCompare() {
    if (!fromVersionId || !toVersionId || !policyId) {
      setError("Select From version, To version, and Policy");
      return;
    }
    setError(null);
    setMissingVersionId(null);
    setResult(null);
    setLoading(true);
    try {
      const url = `/api/contracts/${contractId}/compare?fromVersionId=${encodeURIComponent(fromVersionId)}&toVersionId=${encodeURIComponent(toVersionId)}&policyId=${encodeURIComponent(policyId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.status === 409 && data.code === "MISSING_ANALYSIS") {
        setMissingVersionId(data.missingVersionId ?? null);
        setError("One or both versions have not been analyzed for this policy. Analyze the version(s) first.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Compare failed");
        return;
      }
      setResult(data as VersionCompareResult);
    } catch {
      setError("Compare failed");
    } finally {
      setLoading(false);
    }
  }

  async function exportReport() {
    if (!fromVersionId || !toVersionId || !policyId || !canExportReport) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/compare/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromVersionId, toVersionId, policyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "compare-report.html";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function exportReportPdf() {
    if (!fromVersionId || !toVersionId || !policyId || !canExportReport) return;
    setExportingPdf(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/compare/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromVersionId, toVersionId, policyId, format: "pdf" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Contract_Compare.pdf";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("Export failed");
    } finally {
      setExportingPdf(false);
    }
  }

  const deltaLabelClass =
    result?.delta.label === "IMPROVED"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : result?.delta.label === "WORSENED"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select versions and policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm">From version</Label>
              <select
                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                value={fromVersionId}
                onChange={(e) => setFromVersionId(e.target.value)}
              >
                <option value="">Select</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm">To version</Label>
              <select
                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                value={toVersionId}
                onChange={(e) => setToVersionId(e.target.value)}
              >
                <option value="">Select</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm">Policy</Label>
              <select
                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
              >
                <option value="">Select</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runCompare} disabled={loading}>
              {loading ? "Comparing…" : "Compare"}
            </Button>
            {result && canExportReport && (
              <>
                <Button variant="outline" onClick={exportReport} disabled={exporting}>
                  {exporting ? "Exporting…" : "Export report (HTML)"}
                </Button>
                <Button variant="outline" onClick={exportReportPdf} disabled={exportingPdf}>
                  {exportingPdf ? "Exporting…" : "Export PDF"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
          {missingVersionId && (
            <p className="mt-2">
              <Link href={`/contracts/${contractId}`} className="underline font-medium">
                Go to contract and analyze missing version
              </Link>
            </p>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">v{result.from.versionNumber} raw</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-semibold">{result.from.rawScore}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">v{result.from.versionNumber} effective</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-semibold">{result.from.effectiveScore}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">v{result.to.versionNumber} raw</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-semibold">{result.to.rawScore}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">v{result.to.versionNumber} effective</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-semibold">{result.to.effectiveScore}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Delta
                <span className={`inline-flex rounded px-2 py-0.5 text-sm font-medium ${deltaLabelClass}`}>
                  {result.delta.label}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Raw: {result.delta.raw >= 0 ? "+" : ""}{result.delta.raw} · Effective: {result.delta.effective >= 0 ? "+" : ""}{result.delta.effective}
            </CardContent>
          </Card>

          {result.topDrivers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top drivers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.topDrivers.map((d, i) => (
                    <li key={`${d.key}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono">{d.clauseType}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={d.deltaImpact > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {d.deltaImpact > 0 ? "+" : ""}{d.deltaImpact} — {d.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-sm font-medium">Clause</th>
                      <th className="p-2 text-sm font-medium">Type</th>
                      <th className="p-2 text-sm font-medium">From (v{result.from.versionNumber})</th>
                      <th className="p-2 text-sm font-medium">To (v{result.to.versionNumber})</th>
                      <th className="p-2 text-sm font-medium">Why</th>
                      <th className="p-2 text-sm font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changes.map((c, i) => (
                      <ChangeRow
                        key={`${c.key}-${i}`}
                        change={c}
                        fromVersionNumber={result.from.versionNumber}
                        toVersionNumber={result.to.versionNumber}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
