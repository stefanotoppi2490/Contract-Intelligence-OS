"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Member = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

const ROLES = ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER", "VIEWER"] as const;

export function MembersPageClient({
  initialMembers,
  currentUserId,
}: {
  initialMembers: Member[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add member");
        return;
      }
      if (data.member) {
        setMembers((prev) => [...prev, data.member]);
      }
      setAddSuccess(data.message ?? "Member added.");
      setEmail("");
      router.refresh();
    } catch {
      setAddError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    setPatchingId(membershipId);
    try {
      const res = await fetch(`/api/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to update role");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, role: newRole } : m))
      );
      router.refresh();
    } finally {
      setPatchingId(null);
    }
  }

  async function handleRemove(membershipId: string) {
    if (!confirm("Remove this member from the workspace?")) return;
    setDeletingId(membershipId);
    try {
      const res = await fetch(`/api/members/${membershipId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to remove member");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Add member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                disabled={loading}
              />
            </div>
            <div className="space-y-2 min-w-[120px]">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={loading}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add"}
            </Button>
          </form>
          {addError && <p className="mt-2 text-sm text-destructive">{addError}</p>}
          {addSuccess && <p className="mt-2 text-sm text-muted-foreground">{addSuccess}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3 first:pt-0">
                <div>
                  <p className="font-medium">{m.email}</p>
                  {m.name && <p className="text-sm text-muted-foreground">{m.name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    disabled={patchingId === m.id}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {m.userId !== currentUserId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemove(m.id)}
                      disabled={deletingId === m.id}
                    >
                      {deletingId === m.id ? "Removing…" : "Remove"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
