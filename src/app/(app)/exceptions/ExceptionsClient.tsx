"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ExceptionItem = {
  id: string;
  contractId: string;
  contractVersionId: string;
  contractTitle: string | null;
  clauseType: string | null;
  title: string;
  requestedByName: string | null;
  status: string;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export function ExceptionsClient({
  initialStatus,
  canDecide,
}: {
  initialStatus?: string;
  canDecide: boolean;
}) {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/exceptions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.exceptions) setExceptions(data.exceptions);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium">Status</label>
        <select
          className="rounded border bg-background px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Exception requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exceptions match the filters.</p>
          ) : (
            <ul className="space-y-3 list-none pl-0">
              {exceptions.map((e) => (
                <li key={e.id} className="rounded border p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link href={`/exceptions/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {e.contractTitle ?? "—"} · {e.clauseType ?? "—"} · {e.requestedByName ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.status} · {new Date(e.createdAt).toLocaleString()}
                      {e.decidedAt && ` · Decided by ${e.decidedByName ?? "—"} ${new Date(e.decidedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        e.status === "APPROVED"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : e.status === "REJECTED"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : e.status === "WITHDRAWN"
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {e.status}
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/exceptions/${e.id}`}>View</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
