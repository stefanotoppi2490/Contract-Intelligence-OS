"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Counterparty = { id: string; name: string; type: string; notes: string | null };

export function CounterpartiesClient({
  counterparties: initial,
  canMutate,
}: {
  counterparties: Counterparty[];
  canMutate: boolean;
}) {
  const [counterparties, setCounterparties] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>("CUSTOMER");
  const [editNotes, setEditNotes] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("CUSTOMER");
  const [newNotes, setNewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function startEdit(c: Counterparty) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditType(c.type);
    setEditNotes(c.notes ?? "");
  }

  async function saveEdit() {
    if (!editingId || !canMutate) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/counterparties/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          notes: editNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        return;
      }
      setCounterparties((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, name: data.name, type: data.type, notes: data.notes } : p))
      );
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!canMutate || !confirm("Remove this counterparty?")) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/counterparties/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete");
        return;
      }
      setCounterparties((prev) => prev.filter((p) => p.id !== id));
      setEditingId((x) => (x === id ? null : x));
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!canMutate) return;
    setError(null);
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/counterparties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          notes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create");
        return;
      }
      setCounterparties((prev) => [...prev, data]);
      setShowForm(false);
      setNewName("");
      setNewNotes("");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {canMutate && (
        <Card>
          <CardHeader>
            <CardTitle>Add counterparty</CardTitle>
          </CardHeader>
          <CardContent>
            {showForm ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={loading}
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="VENDOR">VENDOR</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Notes"
                    disabled={loading}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={create} disabled={loading}>
                    {loading ? "Creating…" : "Create"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)} disabled={loading}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowForm(true)}>New counterparty</Button>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Counterparties</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {counterparties.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3 first:pt-0">
                {editingId === c.id ? (
                  <div className="flex flex-1 flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        disabled={loading}
                      >
                        <option value="CUSTOMER">CUSTOMER</option>
                        <option value="VENDOR">VENDOR</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="h-9"
                        disabled={loading}
                      />
                    </div>
                    <Button size="sm" onClick={saveEdit} disabled={loading}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.type}
                        {c.notes ? ` · ${c.notes.slice(0, 50)}${c.notes.length > 50 ? "…" : ""}` : ""}
                      </p>
                    </div>
                    {canMutate && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(c.id)} disabled={loading}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {counterparties.length === 0 && (
            <p className="text-center text-muted-foreground">No counterparties yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
