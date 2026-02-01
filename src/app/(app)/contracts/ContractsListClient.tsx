"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Contract = {
  id: string;
  title: string;
  status: string;
  contractType: string | null;
  counterpartyId: string;
  counterpartyName: string;
  createdAt: string;
};

type Counterparty = { id: string; name: string };

export function ContractsListClient({
  contracts,
  counterparties,
}: {
  contracts: Contract[];
  counterparties: Counterparty[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/contracts?${next.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <select
            className="ml-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={searchParams.get("status") ?? ""}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="">All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="SIGNED">SIGNED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Type</label>
          <select
            className="ml-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={searchParams.get("contractType") ?? ""}
            onChange={(e) => setFilter("contractType", e.target.value)}
          >
            <option value="">All</option>
            <option value="NDA">NDA</option>
            <option value="MSA">MSA</option>
            <option value="SOW">SOW</option>
            <option value="SLA">SLA</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Counterparty</label>
          <select
            className="ml-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={searchParams.get("counterpartyId") ?? ""}
            onChange={(e) => setFilter("counterpartyId", e.target.value)}
          >
            <option value="">All</option>
            {counterparties.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ul className="divide-y rounded-lg border">
        {contracts.map((c) => (
          <li key={c.id}>
            <Link href={`/contracts/${c.id}`} className="block p-4 hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.counterpartyName} · {c.contractType ?? "—"} · {c.status}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {contracts.length === 0 && (
        <p className="text-center text-muted-foreground">No contracts yet. Create one to get started.</p>
      )}
    </div>
  );
}
