"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EVENT_TYPES = [
  "CONTRACT_UPLOADED",
  "TEXT_EXTRACTED",
  "ANALYSIS_RUN",
  "EXCEPTION_REQUESTED",
  "EXCEPTION_APPROVED",
  "EXCEPTION_REJECTED",
  "EXCEPTION_WITHDRAWN",
  "POLICY_CREATED",
  "POLICY_RULE_CREATED",
  "POLICY_RULE_UPDATED",
  "POLICY_RULE_DELETED",
] as const;

type LedgerEvent = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  contractId: string | null;
  contractVersionId: string | null;
  policyId: string | null;
  exceptionId: string | null;
  metadata: unknown;
  createdAt: string;
  summary: string;
};

function EventRow({ event: e }: { event: LedgerEvent }) {
  const [showDetails, setShowDetails] = useState(false);
  const isExceptionEvent =
    e.type === "EXCEPTION_REQUESTED" ||
    e.type === "EXCEPTION_APPROVED" ||
    e.type === "EXCEPTION_REJECTED" ||
    e.type === "EXCEPTION_WITHDRAWN";
  return (
    <>
      <tr className="border-b border-muted/50">
        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">
          {new Date(e.createdAt).toLocaleString()}
        </td>
        <td className="py-1.5 pr-2 font-mono text-xs">{e.type}</td>
        <td className="py-1.5 pr-2 max-w-md">{e.summary}</td>
        <td className="py-1.5 pr-2">
          <span className="font-mono text-xs">{e.entityType}</span>
          {e.entityId && (
            <>
              {" "}
              {isExceptionEvent ? (
                <Link href={`/exceptions/${e.entityId}`} className="text-primary hover:underline">
                  {e.entityId.slice(0, 8)}…
                </Link>
              ) : (
                <span className="text-muted-foreground">{e.entityId.slice(0, 12)}…</span>
              )}
            </>
          )}
        </td>
        <td className="py-1.5 pr-2">
          {e.contractId ? (
            <Link href={`/contracts/${e.contractId}`} className="text-primary hover:underline">
              {e.contractId.slice(0, 8)}…
            </Link>
          ) : (
            "—"
          )}
        </td>
        <td className="py-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setShowDetails((x) => !x)}
          >
            {showDetails ? "Hide" : "Details"}
          </Button>
        </td>
      </tr>
      {showDetails && (
        <tr className="border-b border-muted/50 bg-muted/20">
          <td colSpan={6} className="py-2 px-2">
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
              {e.metadata != null ? JSON.stringify(e.metadata, null, 2) : "—"}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function LedgerClient() {
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [contractIdFilter, setContractIdFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (contractIdFilter.trim()) params.set("contractId", contractIdFilter.trim());
    params.set("limit", "50");
    fetch(`/api/ledger?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
      })
      .finally(() => setLoading(false));
  }, [typeFilter, contractIdFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Type</label>
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Contract ID</label>
          <input
            type="text"
            className="rounded border bg-background px-2 py-1 text-sm w-48"
            value={contractIdFilter}
            onChange={(e) => setContractIdFilter(e.target.value)}
            placeholder="Filter by contract"
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ledger (latest 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events match the filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Time</th>
                    <th className="text-left py-2 pr-2">Type</th>
                    <th className="text-left py-2 pr-2">Summary</th>
                    <th className="text-left py-2 pr-2">Entity</th>
                    <th className="text-left py-2 pr-2">Contract</th>
                    <th className="text-left py-2 w-16">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
