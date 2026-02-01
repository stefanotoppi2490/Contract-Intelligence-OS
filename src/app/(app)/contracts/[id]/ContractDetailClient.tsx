"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Doc = { id: string; originalName: string; mimeType: string | null; size: number | null; storageKey: string | null };
type Version = { id: string; versionNumber: number; documents: Doc[] };
type Payload = {
  id: string;
  title: string;
  status: string;
  contractType: string | null;
  counterpartyName: string;
  versions: Version[];
};

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function ContractDetailClient({
  contractId,
  payload,
  canMutate,
}: {
  contractId: string;
  payload: Payload;
  canMutate: boolean;
}) {
  const [addingVersion, setAddingVersion] = useState(false);
  const [docForm, setDocForm] = useState<{ versionId: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function addVersion() {
    if (!canMutate) return;
    setError(null);
    setAddingVersion(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/versions`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add version");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setAddingVersion(false);
    }
  }

  async function attachDocument(versionId: string) {
    if (!canMutate) return;
    setError(null);
    if (!file) {
      setError("Select a file");
      return;
    }
    const mime = file.type;
    if (!ALLOWED_MIME.includes(mime)) {
      setError("Allowed: PDF, DOCX, TXT");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: file.name,
            mimeType: mime,
            size: file.size,
            storageKey: `pending://${crypto.randomUUID()}`,
            source: "UPLOAD",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.message ?? "Failed to attach document");
        return;
      }
      setDocForm(null);
      setFile(null);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {payload.versions.map((v) => (
            <div key={v.id} className="rounded-lg border p-4 space-y-2">
              <p className="font-medium">Version {v.versionNumber}</p>
              <ul className="text-sm text-muted-foreground">
                {v.documents.length === 0 ? (
                  <li>No documents</li>
                ) : (
                  v.documents.map((d) => (
                    <li key={d.id}>
                      {d.originalName} {d.size != null ? `(${d.size} bytes)` : ""}
                    </li>
                  ))
                )}
              </ul>
              {canMutate && (
                <div className="pt-2">
                  {docForm?.versionId === v.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <Label className="text-sm">File (metadata only)</Label>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          className="ml-2 block text-sm"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                          disabled={uploading}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => attachDocument(v.id)}
                        disabled={uploading || !file}
                      >
                        {uploading ? "Attaching…" : "Attach"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDocForm(null);
                          setFile(null);
                        }}
                        disabled={uploading}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDocForm({ versionId: v.id })}
                    >
                      Attach document metadata
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {canMutate && (
            <Button
              variant="outline"
              onClick={addVersion}
              disabled={addingVersion}
            >
              {addingVersion ? "Adding…" : "Add new version"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
