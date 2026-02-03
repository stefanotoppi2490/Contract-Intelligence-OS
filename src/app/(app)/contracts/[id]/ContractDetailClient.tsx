"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Doc = {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  storageKey: string | null;
  ingestionStatus: string | null;
  lastError: string | null;
};
type VersionText = {
  status: string;
  preview: string;
  extractedAt: string;
  errorMessage: string | null;
  extractor: string;
} | null;
type Compliance = {
  policyId: string;
  policyName: string;
  score: number;
  effectiveScore?: number;
  status: string;
  unclearCount?: number;
  violationCount?: number;
  compliantCount?: number;
  needsReview?: boolean;
};
type Finding = {
  id: string;
  clauseType: string;
  ruleId: string;
  complianceStatus: string;
  severity: string | null;
  riskType: string | null;
  recommendation: string | null;
  foundText: string | null;
  foundValue: unknown;
  confidence: number | null;
  parseNotes: string | null;
  expectedValue: unknown;
  exceptionId: string | null;
  exceptionStatus: string | null;
  isOverridden: boolean;
  unclearReason: string | null;
};
type Extraction = {
  id: string;
  clauseType: string;
  extractedValue: unknown;
  extractedText: string | null;
  confidence: number;
  sourceLocation: unknown;
  extractedBy: string;
  createdAt: string;
};
type Version = {
  id: string;
  versionNumber: number;
  documents: Doc[];
  versionText: VersionText;
  compliances: Compliance[];
  findings: Finding[];
  extractions?: Extraction[];
};
type Payload = {
  id: string;
  title: string;
  status: string;
  contractType: string | null;
  counterpartyName: string;
  versions: Version[];
};

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function FindingRow({
  finding: f,
  versionId,
  contractId,
  canRequestException,
  onRequestException,
}: {
  finding: Finding;
  versionId: string;
  contractId: string;
  canRequestException: boolean;
  onRequestException: (findingId: string) => void;
}) {
  const [showExcerpt, setShowExcerpt] = useState(false);
  const statusColor =
    f.complianceStatus === "VIOLATION"
      ? "text-red-600 dark:text-red-400"
      : f.complianceStatus === "COMPLIANT"
        ? "text-green-600 dark:text-green-400"
        : f.complianceStatus === "UNCLEAR"
          ? "text-amber-600 dark:text-amber-400"
          : "";
  const hasActiveException = f.exceptionId && (f.exceptionStatus === "REQUESTED" || f.exceptionStatus === "APPROVED");
  const showRequestButton =
    canRequestException &&
    (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR") &&
    !hasActiveException;
  return (
    <li className="rounded border p-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{f.clauseType}</span>
        {f.complianceStatus === "UNCLEAR" ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            UNCLEAR
          </span>
        ) : (
          <span className={statusColor}>{f.complianceStatus}</span>
        )}
        {f.isOverridden && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Overridden
          </span>
        )}
        {hasActiveException && f.exceptionId && (
          <Link
            href={`/exceptions/${f.exceptionId}`}
            className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground hover:underline"
          >
            Exception: {f.exceptionStatus}
          </Link>
        )}
        {f.confidence != null && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            {Math.round(f.confidence * 100)}% confidence
          </span>
        )}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">Found:</span>
        <span>{formatValue(f.foundValue)}</span>
        <span className="text-muted-foreground">Expected:</span>
        <span>{formatValue(f.expectedValue)}</span>
      </div>
      {f.complianceStatus === "UNCLEAR" && (f.unclearReason === "LOW_CONFIDENCE" || f.confidence != null) && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {f.unclearReason === "LOW_CONFIDENCE" && f.confidence != null
            ? `Low extraction confidence (${Math.round(f.confidence * 100)}%), needs review`
            : f.parseNotes ?? "Low confidence or value could not be parsed."}
        </p>
      )}
      {f.complianceStatus === "UNCLEAR" && !f.unclearReason && !(f.confidence != null) && f.parseNotes && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{f.parseNotes}</p>
      )}
      {f.foundText && (
        <div className="pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => setShowExcerpt((x) => !x)}
          >
            {showExcerpt ? "Hide excerpt" : "Show excerpt"}
          </Button>
          {showExcerpt && (
            <blockquote className="mt-1 pl-2 border-l-2 text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {f.foundText}
            </blockquote>
          )}
        </div>
      )}
      {f.recommendation && (
        <p className="text-xs text-muted-foreground">{f.recommendation}</p>
      )}
      {showRequestButton && (
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onRequestException(f.id)}
          >
            Request exception
          </Button>
        </div>
      )}
    </li>
  );
}

function IngestionBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const variant =
    status === "TEXT_READY"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : status === "ERROR"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${variant}`}>
      {status}
    </span>
  );
}

type PolicyOption = { id: string; name: string };

type RiskCluster = {
  riskType: string;
  level: string;
  violationCount: number;
  unclearCount: number;
  overriddenCount: number;
  maxSeverity: string | null;
  totalWeight: number;
  topDrivers: { clauseType: string; severity: string | null; weight: number; reason: string }[];
};
type RiskSummaryData = {
  aggregation: {
    overallStatus: string;
    rawScore: number;
    effectiveScore: number;
    clusters: RiskCluster[];
    topDrivers: RiskCluster["topDrivers"];
    generatedAt: string;
  };
  summary: {
    headline: string;
    paragraphs: string[];
    keyRisks: string[];
    recommendation: string;
  };
};

export function ContractDetailClient({
  contractId,
  payload,
  policies,
  canMutate,
  canAnalyze,
}: {
  contractId: string;
  payload: Payload;
  policies: PolicyOption[];
  canMutate: boolean;
  canAnalyze: boolean;
}) {
  const [addingVersion, setAddingVersion] = useState(false);
  const [uploadForm, setUploadForm] = useState<{ versionId: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extractingVersionId, setExtractingVersionId] = useState<string | null>(null);
  const [expandedTextVersionId, setExpandedTextVersionId] = useState<string | null>(null);
  const [expandedExtractionsVersionId, setExpandedExtractionsVersionId] = useState<string | null>(null);
  const [fullTextCache, setFullTextCache] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [analyzingVersionId, setAnalyzingVersionId] = useState<string | null>(null);
  const [runningExtractionVersionId, setRunningExtractionVersionId] = useState<string | null>(null);
  const [selectedPolicyByVersion, setSelectedPolicyByVersion] = useState<Record<string, string>>({});
  const [exceptionModal, setExceptionModal] = useState<{ versionId: string; findingId: string } | null>(null);
  const [exceptionTitle, setExceptionTitle] = useState("");
  const [exceptionJustification, setExceptionJustification] = useState("");
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false);
  const [riskSummaryCache, setRiskSummaryCache] = useState<Record<string, RiskSummaryData | null>>({});
  const [riskSummaryLoading, setRiskSummaryLoading] = useState<string | null>(null);
  const [riskSummaryPolicyByVersion, setRiskSummaryPolicyByVersion] = useState<Record<string, string>>({});
  const [exportingRiskSummary, setExportingRiskSummary] = useState<string | null>(null);
  const [narrativeCache, setNarrativeCache] = useState<Record<string, string>>({});
  const [narrativeLoading, setNarrativeLoading] = useState<string | null>(null);
  const router = useRouter();

  function riskSummaryKey(versionId: string, policyId: string) {
    return `${versionId}-${policyId}`;
  }

  async function fetchRiskSummary(versionId: string, policyId: string) {
    const key = riskSummaryKey(versionId, policyId);
    if (riskSummaryCache[key] !== undefined) return;
    setRiskSummaryLoading(key);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/risk-summary?policyId=${encodeURIComponent(policyId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRiskSummaryCache((prev) => ({ ...prev, [key]: null }));
        return;
      }
      const data = await res.json();
      setRiskSummaryCache((prev) => ({ ...prev, [key]: data }));
    } finally {
      setRiskSummaryLoading((k) => (k === key ? null : k));
    }
  }

  useEffect(() => {
    payload.versions.forEach((v) => {
      if (v.compliances.length === 0) return;
      const policyId = riskSummaryPolicyByVersion[v.id] ?? v.compliances[0]?.policyId;
      if (!policyId) return;
      const key = riskSummaryKey(v.id, policyId);
      if (riskSummaryCache[key] !== undefined || riskSummaryLoading === key) return;
      fetchRiskSummary(v.id, policyId);
    });
  }, [payload.versions, riskSummaryPolicyByVersion, riskSummaryCache, riskSummaryLoading]);

  async function generateNarrative(versionId: string, policyId: string) {
    const key = riskSummaryKey(versionId, policyId);
    setNarrativeLoading(key);
    try {
      const res = await fetch(`/api/contracts/${contractId}/executive-narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, versionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate narrative");
        return;
      }
      setNarrativeCache((prev) => ({ ...prev, [key]: data.narrative ?? "" }));
    } finally {
      setNarrativeLoading((k) => (k === key ? null : k));
    }
  }

  const [exportFormat, setExportFormat] = useState<"pdf" | "html" | "md">("html");
  const [includeNarrativeExport, setIncludeNarrativeExport] = useState(false);

  async function exportExecutiveSummary(versionId: string, policyId: string) {
    const key = `${versionId}-export`;
    setExportingRiskSummary(key);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/executive-summary/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId,
          versionId,
          format: exportFormat,
          includeNarrative: includeNarrativeExport,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (res.status === 403 ? "PDF export requires LEGAL, RISK, or ADMIN role." : "Export failed"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = exportFormat === "md" ? "md" : exportFormat === "pdf" ? "pdf" : "html";
      a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `ExecutiveSummary.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingRiskSummary(null);
    }
  }

  function openRequestExceptionModal(findingId: string) {
    const version = payload.versions.find((v) => v.findings.some((f) => f.id === findingId));
    if (version) setExceptionModal({ versionId: version.id, findingId });
    setExceptionTitle("");
    setExceptionJustification("");
  }

  async function submitRequestException() {
    if (!exceptionModal || !exceptionTitle.trim() || !exceptionJustification.trim()) return;
    if (!canAnalyze) return;
    setError(null);
    setExceptionSubmitting(true);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${exceptionModal.versionId}/exceptions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clauseFindingId: exceptionModal.findingId,
            title: exceptionTitle.trim(),
            justification: exceptionJustification.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (res.status === 409 ? "An exception already exists for this finding." : "Request failed"));
        if (res.status === 409 && data.existingExceptionId) {
          router.push(`/exceptions/${data.existingExceptionId}`);
        }
        return;
      }
      setExceptionModal(null);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setExceptionSubmitting(false);
    }
  }

  async function addVersion() {
    if (!canMutate) return;
    setError(null);
    setAddingVersion(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/versions`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add version");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setAddingVersion(false);
    }
  }

  async function uploadDocument(versionId: string) {
    if (!canMutate) return;
    setError(null);
    if (!file) {
      setError("Select a file");
      return;
    }
    const mime = file.type;
    if (!ALLOWED_MIME.includes(mime)) {
      setError("Allowed: PDF, DOCX, TXT");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setUploadForm(null);
      setFile(null);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function extractText(versionId: string) {
    if (!canMutate) return;
    setError(null);
    setExtractingVersionId(versionId);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/extract-text`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extract failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setExtractingVersionId(null);
    }
  }

  async function loadFullText(versionId: string) {
    if (fullTextCache[versionId]) {
      setExpandedTextVersionId(versionId);
      return;
    }
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/text?limit=50000`
      );
      const data = await res.json();
      if (res.ok && typeof data.fullText === "string") {
        setFullTextCache((prev) => ({ ...prev, [versionId]: data.fullText }));
        setExpandedTextVersionId(versionId);
      }
    } catch {
      setError("Failed to load full text");
    }
  }

  async function analyzeContract(versionId: string, policyId: string) {
    if (!canAnalyze) return;
    setError(null);
    setAnalyzingVersionId(versionId);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/analyze`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policyId }) }
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "MISSING_EXTRACTIONS") {
          setError("Run AI clause extraction first.");
        } else {
          setError(data.error ?? "Analysis failed");
        }
        return;
      }
      router.refresh();
    } catch {
      setError("Analysis failed");
    } finally {
      setAnalyzingVersionId(null);
    }
  }

  async function runClauseExtraction(versionId: string) {
    if (!canAnalyze) return;
    setError(null);
    setRunningExtractionVersionId(versionId);
    try {
      const res = await fetch(`/api/contracts/${contractId}/versions/${versionId}/extractions/run`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Clause extraction failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Clause extraction failed");
    } finally {
      setRunningExtractionVersionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {payload.versions.map((v) => {
            const hasDoc = v.documents.length > 0;
            const doc = v.documents[0] ?? null;
            const versionText = v.versionText;
            const isExpanded = expandedTextVersionId === v.id;
            const fullText = fullTextCache[v.id];
            return (
              <div key={v.id} className="rounded-lg border p-4 space-y-3">
                <p className="font-medium">Version {v.versionNumber}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {!hasDoc ? (
                    <li>No document</li>
                  ) : (
                    doc && (
                      <li className="flex items-center gap-2 flex-wrap">
                        <span>{doc.originalName}</span>
                        {doc.size != null && <span>({doc.size} bytes)</span>}
                        <IngestionBadge status={doc.ingestionStatus} />
                        {doc.lastError && (
                          <span className="text-destructive text-xs">{doc.lastError}</span>
                        )}
                      </li>
                    )
                  )}
                </ul>

                {/* Extract text + Run AI clause extraction (STEP 8B) */}
                {hasDoc && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => extractText(v.id)}
                      disabled={!canMutate || extractingVersionId !== null}
                    >
                      {extractingVersionId === v.id ? "Extracting…" : "Extract text"}
                    </Button>
                    {versionText?.status === "TEXT_READY" && canAnalyze && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runClauseExtraction(v.id)}
                        disabled={runningExtractionVersionId !== null}
                      >
                        {runningExtractionVersionId === v.id ? "Running…" : "Run AI clause extraction"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Analysis — always visible per version */}
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-4 space-y-3">
                  <p className="text-sm font-semibold">Analysis</p>
                  {policies.length === 0 ? (
                    <div
                      className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                      role="alert"
                    >
                      No active policy found.{" "}
                      <Link href="/policies" className="underline font-medium">
                        Create a policy
                      </Link>{" "}
                      to analyze contracts.
                    </div>
                  ) : (
                    <>
                      {!canAnalyze && (
                        <p className="text-sm text-muted-foreground">
                          Only LEGAL, RISK, or ADMIN can run analysis.
                        </p>
                      )}
                      {canAnalyze && (!versionText || versionText.status !== "TEXT_READY") && (
                        <p className="text-sm text-muted-foreground">
                          Extract text first to enable analysis.
                        </p>
                      )}
                      {canAnalyze && versionText?.status === "TEXT_READY" && (!v.extractions || v.extractions.length === 0) && (
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Run AI clause extraction first to analyze against a policy.
                        </p>
                      )}
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <Label className="text-sm">Policy</Label>
                          <select
                            className="ml-2 rounded border bg-background px-2 py-1 text-sm"
                            value={selectedPolicyByVersion[v.id] ?? ""}
                            onChange={(e) =>
                              setSelectedPolicyByVersion((prev) => ({ ...prev, [v.id]: e.target.value }))
                            }
                          >
                            <option value="">Select policy</option>
                            {policies.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => analyzeContract(v.id, selectedPolicyByVersion[v.id] ?? "")}
                          disabled={
                            !canAnalyze ||
                            !versionText ||
                            versionText.status !== "TEXT_READY" ||
                            !selectedPolicyByVersion[v.id] ||
                            analyzingVersionId !== null
                          }
                        >
                          {analyzingVersionId === v.id ? "Analyzing…" : "Analyze contract"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Executive Risk Summary — STEP 9A */}
                {v.compliances.length > 0 && (
                  <div className="rounded border bg-muted/20 p-3 space-y-2">
                    <p className="text-sm font-medium">Executive Risk Summary</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`risk-policy-${v.id}`} className="text-xs text-muted-foreground">
                        Policy:
                      </Label>
                      <select
                        id={`risk-policy-${v.id}`}
                        className="rounded border bg-background px-2 py-1 text-sm"
                        value={riskSummaryPolicyByVersion[v.id] ?? v.compliances[0]?.policyId ?? ""}
                        onChange={(e) => {
                          const policyId = e.target.value;
                          if (policyId) {
                            setRiskSummaryPolicyByVersion((prev) => ({ ...prev, [v.id]: policyId }));
                            fetchRiskSummary(v.id, policyId);
                          }
                        }}
                      >
                        {v.compliances.map((c) => (
                          <option key={c.policyId} value={c.policyId}>
                            {c.policyName}
                          </option>
                        ))}
                      </select>
                      <Label className="text-xs text-muted-foreground">Format:</Label>
                      <select
                        className="rounded border bg-background px-2 py-1 text-sm"
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as "pdf" | "html" | "md")}
                      >
                        <option value="pdf">PDF</option>
                        <option value="html">HTML</option>
                        <option value="md">Markdown</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={includeNarrativeExport}
                          onChange={(e) => setIncludeNarrativeExport(e.target.checked)}
                        />
                        Include AI narrative
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={exportingRiskSummary === `${v.id}-export`}
                        onClick={() => {
                          const policyId = riskSummaryPolicyByVersion[v.id] ?? v.compliances[0]?.policyId;
                          if (policyId) exportExecutiveSummary(v.id, policyId);
                        }}
                      >
                        {exportingRiskSummary === `${v.id}-export` ? "Exporting…" : "Export Executive Summary"}
                      </Button>
                    </div>
                    {(() => {
                      const policyId = riskSummaryPolicyByVersion[v.id] ?? v.compliances[0]?.policyId ?? "";
                      if (!policyId) return null;
                      const key = riskSummaryKey(v.id, policyId);
                      const loading = riskSummaryLoading === key;
                      const data = riskSummaryCache[key];
                      if (loading && !data) {
                        return <p className="text-sm text-muted-foreground">Loading risk summary…</p>;
                      }
                      if (!data) {
                        return null;
                      }
                      const { aggregation, summary } = data;
                      return (
                        <div className="space-y-3 pt-2 text-sm">
                          <p className="font-medium">{summary.headline}</p>
                          <p className="text-muted-foreground">
                            Score: <span className="font-mono font-medium text-foreground">{aggregation.effectiveScore}</span>/100
                            {aggregation.effectiveScore !== aggregation.rawScore && (
                              <span className="ml-1 text-xs">(raw {aggregation.rawScore})</span>
                            )}
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-1 pr-2">Risk type</th>
                                  <th className="text-left py-1 pr-2">Level</th>
                                  <th className="text-left py-1 pr-2">Violations</th>
                                  <th className="text-left py-1 pr-2">Unclear</th>
                                </tr>
                              </thead>
                              <tbody>
                                {aggregation.clusters.map((c) => (
                                  <tr key={c.riskType} className="border-b border-muted">
                                    <td className="py-1 pr-2">{c.riskType}</td>
                                    <td className="py-1 pr-2">
                                      <span
                                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                                          c.level === "HIGH"
                                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                            : c.level === "MEDIUM"
                                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                              : c.level === "NEEDS_REVIEW"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                        }`}
                                      >
                                        {c.level}
                                      </span>
                                    </td>
                                    <td className="py-1 pr-2">{c.violationCount}</td>
                                    <td className="py-1 pr-2">{c.unclearCount}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {summary.keyRisks.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Key risks</p>
                              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                                {summary.keyRisks.map((k, i) => (
                                  <li key={i}>{k}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Recommendation:</span> {summary.recommendation}
                          </p>
                          {/* Executive Narrative (AI-generated) — STEP 9B */}
                          <div className="pt-3 border-t border-muted space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Executive Narrative (AI-generated)
                            </p>
                            {narrativeLoading === riskSummaryKey(v.id, policyId) ? (
                              <p className="text-sm text-muted-foreground">Generating narrative…</p>
                            ) : narrativeCache[riskSummaryKey(v.id, policyId)] ? (
                              <p className="text-sm text-foreground whitespace-pre-wrap">
                                {narrativeCache[riskSummaryKey(v.id, policyId)]}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">Generated from structured risk data</p>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={narrativeLoading === riskSummaryKey(v.id, policyId)}
                              onClick={() => generateNarrative(v.id, policyId)}
                            >
                              {narrativeCache[riskSummaryKey(v.id, policyId)]
                                ? "Regenerate narrative"
                                : "Generate narrative"}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Compliance score + findings */}
                {(v.compliances.length > 0 || v.findings.length > 0) && (
                  <div className="rounded border bg-muted/20 p-3 space-y-2">
                    <p className="text-sm font-medium">Compliance</p>
                    {v.compliances.length > 0 && (
                      <ul className="text-sm space-y-1">
                        {v.compliances.map((c) => (
                          <li key={c.policyId}>
                            <span className="font-medium">{c.policyName}</span>: score{" "}
                            <span className="font-mono">{c.effectiveScore ?? c.score}</span>/100
                            {(c.effectiveScore != null && c.effectiveScore !== c.score) && (
                              <span className="text-muted-foreground text-xs ml-1">
                                (raw {c.score})
                              </span>
                            )}{" "}
                            —{" "}
                            <span
                              className={
                                c.status === "COMPLIANT"
                                  ? "text-green-600 dark:text-green-400"
                                  : c.status === "NON_COMPLIANT"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                              }
                            >
                              {c.status}
                            </span>
                            {c.unclearCount != null && c.unclearCount > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 text-xs ml-1">
                                ⚠ {c.unclearCount} clause{c.unclearCount === 1 ? "" : "s"} need{c.unclearCount === 1 ? "s" : ""} review
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {v.findings.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Findings</p>
                        <ul className="text-sm space-y-3 list-none pl-0">
                          {v.findings.map((f) => (
                            <FindingRow
                              key={f.id}
                              finding={f}
                              versionId={v.id}
                              contractId={contractId}
                              canRequestException={canAnalyze}
                              onRequestException={openRequestExceptionModal}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* AI-extracted clauses (preview) — STEP 8A */}
                {v.extractions && v.extractions.length > 0 && (
                  <div className="rounded border border-dashed border-slate-300 bg-slate-50/50 dark:bg-slate-900/20 p-3 space-y-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-auto py-1 text-sm font-medium"
                      onClick={() =>
                        setExpandedExtractionsVersionId((id) => (id === v.id ? null : v.id))
                      }
                    >
                      {expandedExtractionsVersionId === v.id ? "▼" : "▶"} AI-extracted clauses (preview)
                    </Button>
                    {expandedExtractionsVersionId === v.id && (
                      <ul className="space-y-3 list-none pl-0 text-sm">
                        {v.extractions.map((e) => (
                          <li key={e.id} className="rounded border bg-background p-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-medium">{e.clauseType}</span>
                              <span
                                className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                                  e.confidence >= 0.7
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : e.confidence >= 0.4
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {(e.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                            {e.extractedValue != null && (
                              <div>
                                <span className="text-muted-foreground text-xs">Value:</span>
                                <pre className="mt-0.5 rounded bg-muted p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                                  {JSON.stringify(e.extractedValue, null, 2)}
                                </pre>
                              </div>
                            )}
                            {e.extractedText && (
                              <div>
                                <span className="text-muted-foreground text-xs">Excerpt:</span>
                                <blockquote className="mt-0.5 pl-2 border-l-2 border-muted-foreground/30 text-muted-foreground whitespace-pre-wrap break-words">
                                  {e.extractedText}
                                </blockquote>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Text preview / error */}
                {versionText && (
                  <div className="rounded border bg-muted/30 p-3 text-sm space-y-2">
                    {versionText.status === "ERROR" && versionText.errorMessage && (
                      <p className="text-destructive font-medium">
                        Extraction error: {versionText.errorMessage}
                      </p>
                    )}
                    {versionText.status === "TEXT_READY" && (
                      <>
                        <p className="text-muted-foreground text-xs">
                          Extracted at {new Date(versionText.extractedAt).toLocaleString()}
                          {versionText.extractor && ` · ${versionText.extractor}`}
                        </p>
                        {isExpanded && fullText !== undefined ? (
                          <div className="whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                            {fullText}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {versionText.preview}
                            {versionText.preview.length >= 500 && "…"}
                          </div>
                        )}
                        {versionText.preview.length >= 500 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => (isExpanded ? setExpandedTextVersionId(null) : loadFullText(v.id))}
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Upload (real file) */}
                {canMutate && (
                  <div className="pt-2">
                    {uploadForm?.versionId === v.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <Label className="text-sm">File</Label>
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                            className="ml-2 block text-sm"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            disabled={uploading}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => uploadDocument(v.id)}
                          disabled={uploading || !file}
                        >
                          {uploading ? "Uploading…" : "Upload"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUploadForm(null);
                            setFile(null);
                          }}
                          disabled={uploading}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUploadForm({ versionId: v.id })}
                        disabled={hasDoc}
                      >
                        {hasDoc ? "Document attached" : "Upload file"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {canMutate && (
            <Button
              variant="outline"
              onClick={addVersion}
              disabled={addingVersion}
            >
              {addingVersion ? "Adding…" : "Add new version"}
            </Button>
          )}
        </CardContent>
      </Card>

      {exceptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-lg border bg-background p-4 shadow-lg max-w-md w-full space-y-3">
            <h3 className="font-semibold">Request exception</h3>
            <div>
              <Label className="text-sm">Title</Label>
              <input
                className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm"
                value={exceptionTitle}
                onChange={(e) => setExceptionTitle(e.target.value)}
                placeholder="Short title for this exception"
              />
            </div>
            <div>
              <Label className="text-sm">Justification</Label>
              <textarea
                className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm min-h-[100px]"
                value={exceptionJustification}
                onChange={(e) => setExceptionJustification(e.target.value)}
                placeholder="Why this exception is requested"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExceptionModal(null)}
                disabled={exceptionSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitRequestException}
                disabled={exceptionSubmitting || !exceptionTitle.trim() || !exceptionJustification.trim()}
              >
                {exceptionSubmitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
