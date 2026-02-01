"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Counterparty = { id: string; name: string };

export function NewContractForm({ counterparties }: { counterparties: Counterparty[] }) {
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<string>("");
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [status, setStatus] = useState<string>("DRAFT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!counterpartyId) {
      setError("Please select a counterparty");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contractType: contractType || undefined,
          counterpartyId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create contract");
        return;
      }
      router.push(`/contracts/${data.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contract title"
              maxLength={500}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="counterpartyId">Counterparty</Label>
            <select
              id="counterpartyId"
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="">Select counterparty</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {counterparties.length === 0 && (
              <p className="text-sm text-muted-foreground">
                <a href="/counterparties" className="underline">
                  Create a counterparty
                </a>{" "}
                first.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractType">Type</Label>
            <select
              id="contractType"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="">—</option>
              <option value="NDA">NDA</option>
              <option value="MSA">MSA</option>
              <option value="SOW">SOW</option>
              <option value="SLA">SLA</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="SIGNED">SIGNED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create contract (v1 will be created)"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
