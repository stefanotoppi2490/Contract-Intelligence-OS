"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Workspace = { id: string; name: string; role: string };

export function WorkspaceSelector({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function select(id: string) {
    setError(null);
    setLoadingId(id);
    try {
      const res = await fetch("/api/workspaces/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to select workspace");
        return;
      }
      router.push("/contracts");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {workspaces.map((w) => (
        <Card key={w.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{w.name}</p>
              <p className="text-sm text-muted-foreground">{w.role}</p>
            </div>
            <Button
              variant={currentWorkspaceId === w.id ? "secondary" : "default"}
              onClick={() => select(w.id)}
              disabled={loadingId !== null}
            >
              {loadingId === w.id ? "Selecting…" : currentWorkspaceId === w.id ? "Current" : "Select"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
