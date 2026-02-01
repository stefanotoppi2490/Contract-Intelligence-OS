"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Policy = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  rulesCount: number;
};

export function PoliciesClient({
  policies,
  canCreate,
}: {
  policies: Policy[];
  canCreate: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate || !name.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create policy");
        return;
      }
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Failed to create policy");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              New policies get three default rules (Termination, Liability, Confidentiality) so analysis produces findings.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="policy-name">Name</Label>
                <Input
                  id="policy-name"
                  className="mt-1 max-w-md"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard Vendor Policy"
                  disabled={creating}
                />
              </div>
              <div>
                <Label htmlFor="policy-desc">Description (optional)</Label>
                <Input
                  id="policy-desc"
                  className="mt-1 max-w-md"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description"
                  disabled={creating}
                />
              </div>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : "Create policy"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active policies</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select one when analyzing a contract version on a contract detail page.
          </p>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No policies yet. {canCreate ? "Create one above." : "Ask an admin to create a policy."}
            </p>
          ) : (
            <ul className="space-y-3">
              {policies.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.description && (
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.rulesCount} rule{p.rulesCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Link href="/contracts">
                    <Button variant="outline" size="sm">
                      Use in contract
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
