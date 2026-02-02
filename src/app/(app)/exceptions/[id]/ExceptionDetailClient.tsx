"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Payload = {
  id: string;
  contractId: string;
  contractVersionId: string;
  contractTitle: string | null;
  versionNumber: number | null;
  clauseType: string | null;
  title: string;
  justification: string;
  requestedByUserId: string;
  status: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  finding: {
    id: string;
    clauseType: string;
    complianceStatus: string;
    severity: string | null;
    riskType: string | null;
    recommendation: string | null;
    foundText: string | null;
    foundValue: unknown;
    confidence: number | null;
    expectedValue: unknown;
  } | null;
};

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function ExceptionDetailClient({
  payload,
  canDecide,
  canWithdraw,
}: {
  payload: Payload;
  canDecide: boolean;
  canWithdraw: boolean;
}) {
  const router = useRouter();
  const [decisionReason, setDecisionReason] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!canDecide) return;
    setError(null);
    setLoading(decision === "APPROVE" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/exceptions/${payload.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, decisionReason: decisionReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(null);
    }
  }

  async function withdraw() {
    if (!canWithdraw) return;
    setError(null);
    setLoading("withdraw");
    try {
      const res = await fetch(`/api/exceptions/${payload.id}/withdraw`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p><span className="text-muted-foreground">Title:</span> {payload.title}</p>
          <p><span className="text-muted-foreground">Justification:</span></p>
          <p className="whitespace-pre-wrap rounded border p-3 text-sm">{payload.justification}</p>
          <p>
            <span className="text-muted-foreground">Contract:</span>{" "}
            <Link href={`/contracts/${payload.contractId}`} className="underline">
              {payload.contractTitle ?? payload.contractId}
            </Link>
            {payload.versionNumber != null && ` · Version ${payload.versionNumber}`}
          </p>
          <p><span className="text-muted-foreground">Clause type:</span> {payload.clauseType ?? "—"}</p>
          <p><span className="text-muted-foreground">Status:</span> {payload.status}</p>
          {payload.decidedAt && (
            <p>
              <span className="text-muted-foreground">Decided:</span> {new Date(payload.decidedAt).toLocaleString()}
              {payload.decisionReason && ` · ${payload.decisionReason}`}
            </p>
          )}
        </CardContent>
      </Card>
      {payload.finding && (
        <Card>
          <CardHeader>
            <CardTitle>Linked finding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p><span className="text-muted-foreground">Clause type:</span> {payload.finding.clauseType}</p>
              <p><span className="text-muted-foreground">Status:</span> {payload.finding.complianceStatus}</p>
              {payload.finding.confidence != null && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                  {(payload.finding.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
            <p><span className="text-muted-foreground">Found:</span> {formatValue(payload.finding.foundValue)}</p>
            <p><span className="text-muted-foreground">Expected:</span> {formatValue(payload.finding.expectedValue)}</p>
            {payload.finding.foundText && (
              <div>
                <p className="text-muted-foreground font-medium mb-1">Evidence excerpt</p>
                <blockquote className="pl-2 border-l-2 text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {payload.finding.foundText}
                </blockquote>
              </div>
            )}
            {payload.finding.recommendation && (
              <p className="text-muted-foreground">{payload.finding.recommendation}</p>
            )}
          </CardContent>
        </Card>
      )}
      {payload.status === "REQUESTED" && (canDecide || canWithdraw) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canDecide && (
              <>
                <div>
                  <label className="text-sm font-medium">Decision reason (optional)</label>
                  <textarea
                    className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm min-h-[80px]"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Reason for approval or rejection"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => decide("APPROVE")}
                    disabled={loading !== null}
                  >
                    {loading === "approve" ? "Approving…" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => decide("REJECT")}
                    disabled={loading !== null}
                  >
                    {loading === "reject" ? "Rejecting…" : "Reject"}
                  </Button>
                </div>
              </>
            )}
            {canWithdraw && (
              <Button
                size="sm"
                variant="outline"
                onClick={withdraw}
                disabled={loading !== null}
              >
                {loading === "withdraw" ? "Withdrawing…" : "Withdraw"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
