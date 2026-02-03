"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type VersionOption = { id: string; versionNumber: number };
type PolicyOption = { id: string; name: string };

type DealDeskPreview = {
  contractId: string;
  contractVersionId: string;
  policyId: string;
  effectiveScore: number;
  rawScore: number;
  outcome: string;
  statusSuggestion: string;
  counts: {
    violations: number;
    criticalViolations: number;
    unclear: number;
    overridden: number;
    openExceptions: number;
    approvedExceptions: number;
  };
  topDrivers: Array<{
    clauseType: string;
    riskType: string | null;
    severity: string | null;
    weight: number;
    status: string;
    recommendation: string | null;
  }>;
  rationaleMarkdown: string;
};

type DealDecision = {
  id: string;
  status: string;
  outcome: string;
  rationale: string | null;
  executiveSummary: string | null;
  finalizedByUserId: string | null;
  finalizedAt: string | null;
  policyName?: string;
};

type ExceptionsSummary = {
  openCount: number;
  approvedCount: number;
  open: Array<{ id: string; title: string }>;
  approved: Array<{ id: string; title: string }>;
};

type DealDeskData = {
  preview: DealDeskPreview;
  decision: DealDecision | null;
  exceptionsSummary: ExceptionsSummary;
  contract: { title: string; counterpartyName: string };
  version: { id: string; versionNumber: number };
};

export function DealDeskClient({
  contractId,
  contractTitle,
  counterpartyName,
  versions,
  policies,
  initialVersionId,
  initialPolicyId,
  canMutate,
}: {
  contractId: string;
  contractTitle: string;
  counterpartyName: string;
  versions: VersionOption[];
  policies: PolicyOption[];
  initialVersionId: string | null;
  initialPolicyId: string | null;
  canMutate: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [versionId, setVersionId] = useState(initialVersionId ?? versions[0]?.id ?? "");
  const [policyId, setPolicyId] = useState(initialPolicyId ?? policies[0]?.id ?? "");
  const [data, setData] = useState<DealDeskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingAnalysis, setMissingAnalysis] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [narrativeText, setNarrativeText] = useState<string | null>(null);

  const fetchDealDesk = useCallback(async () => {
    if (!versionId || !policyId) {
      setData(null);
      setMissingAnalysis(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setMissingAnalysis(false);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/deal-desk?policyId=${encodeURIComponent(policyId)}`
      );
      let json: { error?: string; message?: string } = {};
      try {
        json = await res.json();
      } catch {
        setError(res.ok ? "Invalid response" : `Failed to load Deal Desk (${res.status})`);
        setData(null);
        return;
      }
      if (res.status === 409 && (json.error === "MISSING_ANALYSIS" || json.message)) {
        setMissingAnalysis(true);
        setData(null);
        setError(json.message ?? "No compliance record. Analyze contract first.");
        return;
      }
      if (!res.ok) {
        const message = json.error ?? json.message ?? `Failed to load Deal Desk (${res.status})`;
        setError(message);
        setData(null);
        return;
      }
      setData(json as DealDeskData);
      setNarrativeText((json as DealDeskData).decision?.executiveSummary ?? null);
    } catch (err) {
      setError("Network or server error. Try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [contractId, versionId, policyId]);

  useEffect(() => {
    fetchDealDesk();
  }, [fetchDealDesk]);

  useEffect(() => {
    if (!versionId || !policyId) return;
    if (searchParams.get("versionId") === versionId && searchParams.get("policyId") === policyId) return;
    const u = new URLSearchParams(searchParams.toString());
    u.set("versionId", versionId);
    u.set("policyId", policyId);
    router.replace(`/contracts/${contractId}/deal-desk?${u.toString()}`, { scroll: false });
  }, [contractId, versionId, policyId, router, searchParams]);

  async function saveDraft() {
    if (!canMutate || !versionId || !policyId) return;
    setSavingDraft(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/deal-desk/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policyId,
            executiveSummary: narrativeText ?? undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to save draft");
        return;
      }
      await fetchDealDesk();
    } finally {
      setSavingDraft(false);
    }
  }

  async function finalizeDecision() {
    if (!canMutate || !versionId || !policyId) return;
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/deal-desk/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to finalize");
        return;
      }
      await fetchDealDesk();
    } finally {
      setFinalizing(false);
    }
  }

  async function generateNarrative() {
    if (!canMutate || !versionId || !policyId) return;
    setGeneratingNarrative(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/deal-desk/narrative`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to generate narrative");
        return;
      }
      setNarrativeText(json.narrative ?? null);
      await fetchDealDesk();
    } finally {
      setGeneratingNarrative(false);
    }
  }

  async function exportReport(format: "pdf" | "html") {
    if (!canMutate || !versionId || !policyId) return;
    if (format === "pdf") setExportingPdf(true);
    else setExportingHtml(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/deal-desk/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId, format }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `DealDesk.${format}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      if (format === "pdf") setExportingPdf(false);
      else setExportingHtml(false);
    }
  }

  const outcomeBadgeClass =
    data?.preview?.outcome === "GO"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : data?.preview?.outcome === "NO_GO"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Version & policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Version</Label>
              <select
                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
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
          <p className="text-sm text-muted-foreground">
            {contractTitle} · {counterpartyName}
          </p>
        </CardContent>
      </Card>

      {error && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
          {missingAnalysis && (
            <p className="mt-2">
              <Link href={`/contracts/${contractId}`} className="underline font-medium">
                Analyze contract first
              </Link>
            </p>
          )}
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-muted-foreground">Loading Deal Desk…</p>
      )}

      {!loading && versionId && policyId && !data && !missingAnalysis && (
        <p className="text-sm text-muted-foreground">Select a version and policy to load.</p>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Decision
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-sm font-medium ${outcomeBadgeClass}`}
                >
                  {data.preview.outcome.replace("_", "-")}
                </span>
                {data.decision?.status === "FINAL" && (
                  <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                    Final
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Effective score: <span className="font-mono font-semibold">{data.preview.effectiveScore}</span>
                /100
                {data.preview.rawScore !== data.preview.effectiveScore && (
                  <span className="text-muted-foreground ml-1">(raw {data.preview.rawScore})</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span>Violations: {data.preview.counts.violations}</span>
                <span>Critical: {data.preview.counts.criticalViolations}</span>
                <span>Unclear: {data.preview.counts.unclear}</span>
                <span>Overridden: {data.preview.counts.overridden}</span>
                <span>Open exceptions: {data.preview.counts.openExceptions}</span>
                <span>Approved: {data.preview.counts.approvedExceptions}</span>
              </div>
            </CardContent>
          </Card>

          {data.preview.topDrivers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key risks</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.preview.topDrivers.map((d, i) => (
                    <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                      <span className="font-mono">{d.clauseType}</span>
                      <span className="text-muted-foreground">{d.riskType ?? "—"}</span>
                      {d.severity && (
                        <span className="rounded px-1.5 py-0.5 text-xs bg-muted">
                          {d.severity}
                        </span>
                      )}
                      {d.recommendation && (
                        <span className="text-muted-foreground">— {d.recommendation}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Exceptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Open: {data.exceptionsSummary.openCount} · Approved: {data.exceptionsSummary.approvedCount}
              </p>
              {data.exceptionsSummary.open.length > 0 && (
                <ul className="list-disc pl-4 text-sm">
                  {data.exceptionsSummary.open.map((e) => (
                    <li key={e.id}>
                      <Link href={`/exceptions/${e.id}`} className="underline hover:no-underline">
                        {e.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {data.exceptionsSummary.approved.length > 0 && (
                <ul className="list-disc pl-4 text-sm">
                  {data.exceptionsSummary.approved.map((e) => (
                    <li key={e.id}>
                      <Link href={`/exceptions/${e.id}`} className="underline hover:no-underline">
                        {e.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {versions.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/contracts/${contractId}/compare`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Compare with other version
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Executive narrative (AI-generated)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Generated from structured risk data only.
              </p>
              {narrativeText && (
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {narrativeText}
                </div>
              )}
              {canMutate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateNarrative}
                  disabled={generatingNarrative}
                >
                  {generatingNarrative ? "Generating…" : narrativeText ? "Regenerate narrative" : "Generate narrative"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rationale</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm whitespace-pre-wrap font-sans">{data.preview.rationaleMarkdown}</pre>
            </CardContent>
          </Card>

          {canMutate && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={saveDraft} disabled={savingDraft || data.decision?.status === "FINAL"}>
                  {savingDraft ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={finalizeDecision}
                  disabled={finalizing || data.decision?.status === "FINAL"}
                >
                  {finalizing ? "Finalizing…" : "Finalize decision"}
                </Button>
                <Button variant="outline" onClick={() => exportReport("pdf")} disabled={exportingPdf}>
                  {exportingPdf ? "Exporting…" : "Export report (PDF)"}
                </Button>
                <Button variant="outline" onClick={() => exportReport("html")} disabled={exportingHtml}>
                  {exportingHtml ? "Exporting…" : "Export report (HTML)"}
                </Button>
              </CardContent>
            </Card>
          )}

          {!canMutate && (
            <p className="text-sm text-muted-foreground">
              Only LEGAL, RISK, or ADMIN can save draft, finalize, generate narrative, or export.
            </p>
          )}
        </>
      )}
    </div>
  );
}
