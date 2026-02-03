"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Policy = { id: string; name: string };
type Counterparty = { id: string; name: string };

type DashboardRow = {
  contractId: string;
  contractTitle: string;
  counterpartyId: string;
  counterpartyName: string;
  versionId: string;
  versionNumber: number;
  effectiveScore: number;
  status: string;
  violationCount: number;
  unclearCount: number;
  overriddenCount: number;
  riskTypeBreakdown: Record<string, { violations: number; unclear: number }>;
  exceptionsRequested: number;
  exceptionsApproved: number;
  lastAnalyzedAt: string | null;
};

type DashboardResult = {
  rows: DashboardRow[];
  total: number;
  page: number;
  pageSize: number;
  policyId: string;
  policyName: string;
};

const RISK_TYPES = ["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"] as const;

export function DashboardClient({
  policies,
  counterparties,
}: {
  policies: Policy[];
  counterparties: Counterparty[];
}) {
  const [policyId, setPolicyId] = useState("");
  const [status, setStatus] = useState("");
  const [riskType, setRiskType] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [hasOpenExceptions, setHasOpenExceptions] = useState("");
  const [hasUnclear, setHasUnclear] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [data, setData] = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (policyId) params.set("policyId", policyId);
    if (status) params.set("status", status);
    if (riskType) params.set("riskType", riskType);
    if (counterpartyId) params.set("counterpartyId", counterpartyId);
    if (hasOpenExceptions) params.set("hasOpenExceptions", hasOpenExceptions);
    if (hasUnclear) params.set("hasUnclear", hasUnclear);
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("sort", sort);
    params.set("sortOrder", sortOrder);
    const res = await fetch(`/api/dashboard/contracts?${params.toString()}`);
    if (!res.ok) {
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as DashboardResult;
    setData(json);
    if (json.policyId && !policyId) setPolicyId(json.policyId);
    setLoading(false);
  }, [policyId, status, riskType, counterpartyId, hasOpenExceptions, hasUnclear, q, page, sort, sortOrder]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (policies.length > 0 && !policyId && !data?.policyId) setPolicyId(policies[0].id);
  }, [policies, policyId, data?.policyId]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Policy</label>
          <select
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem]"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Status</label>
          <select
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="COMPLIANT">COMPLIANT</option>
            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            <option value="NON_COMPLIANT">NON_COMPLIANT</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Risk type</label>
          <select
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem]"
            value={riskType}
            onChange={(e) => setRiskType(e.target.value)}
          >
            <option value="">All</option>
            {RISK_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {rt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Counterparty</label>
          <select
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem]"
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
          >
            <option value="">All</option>
            {counterparties.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Open exceptions</label>
          <select
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem]"
            value={hasOpenExceptions}
            onChange={(e) => setHasOpenExceptions(e.target.value)}
          >
            <option value="">Any</option>
            <option value="true">Has open</option>
            <option value="false">None</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Unclear</label>
          <select
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem]"
            value={hasUnclear}
            onChange={(e) => setHasUnclear(e.target.value)}
          >
            <option value="">Any</option>
            <option value="true">Has unclear</option>
            <option value="false">None</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#6e7985]">Search</label>
          <input
            type="search"
            placeholder="Title or counterparty"
            className="ml-2 h-9 rounded-[0.375rem] border border-[#e2e5ec] bg-white px-2 text-[0.925rem] min-w-[180px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setPage(1)}
          />
        </div>
      </div>

      {data && (
        <p className="text-sm text-[#6e7985]">
          Policy: <strong>{data.policyName}</strong> · {data.total} contract{data.total !== 1 ? "s" : ""}
        </p>
      )}

      {loading ? (
        <p className="text-[#6e7985]">Loading…</p>
      ) : data && data.rows.length === 0 ? (
        <p className="text-[#6e7985]">No contracts match the filters.</p>
      ) : data ? (
        <>
          <div className="overflow-x-auto rounded-[var(--card-border-radius)] border border-[#e2e5ec] bg-white shadow-[0_0.125rem_0.25rem_rgba(17,20,24,0.075)]">
            <table className="w-full text-left text-[0.925rem]">
              <thead>
                <tr className="border-b border-[#e2e5ec] bg-[#f8f9fc]">
                  <th className="p-3 font-medium text-[#131722]">Contract / Counterparty</th>
                  <th className="p-3 font-medium text-[#131722]">Status</th>
                  <th className="p-3 font-medium text-[#131722]">Score</th>
                  <th className="p-3 font-medium text-[#131722]">V / U / O</th>
                  <th className="p-3 font-medium text-[#131722]">Risk types</th>
                  <th className="p-3 font-medium text-[#131722]">Last analyzed</th>
                  <th className="p-3 font-medium text-[#131722]"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.contractId} className="border-b border-[#e2e5ec] hover:bg-[#f8f9fc]">
                    <td className="p-3">
                      <div className="font-medium text-[#131722]">{row.contractTitle}</div>
                      <div className="text-sm text-[#6e7985]">{row.counterpartyName}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.status === "COMPLIANT"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.status === "NON_COMPLIANT"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-[#131722]">{row.effectiveScore}/100</td>
                    <td className="p-3 text-[#6e7985]">
                      {row.violationCount} / {row.unclearCount} / {row.overriddenCount}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {RISK_TYPES.filter(
                          (rt) =>
                            (row.riskTypeBreakdown[rt]?.violations ?? 0) > 0 ||
                            (row.riskTypeBreakdown[rt]?.unclear ?? 0) > 0
                        ).map((rt) => (
                          <span
                            key={rt}
                            className="rounded bg-[#f3f5f9] px-1.5 py-0.5 text-xs text-[#131722]"
                          >
                            {rt}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-[#6e7985]">
                      {row.lastAnalyzedAt
                        ? new Date(row.lastAnalyzedAt).toLocaleDateString(undefined, {
                            dateStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/contracts/${row.contractId}`}
                        className="text-primary hover:underline"
                        style={{ color: "var(--primary)" }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-[0.375rem] border border-[#e2e5ec] bg-white px-3 py-1.5 text-sm hover:bg-[#f3f5f9] disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-[#6e7985]">
                Page {data.page} of {totalPages}
              </span>
              <button
                type="button"
                className="rounded-[0.375rem] border border-[#e2e5ec] bg-white px-3 py-1.5 text-sm hover:bg-[#f3f5f9] disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
