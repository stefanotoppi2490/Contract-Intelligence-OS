"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Doc = {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  storageKey: string | null;
  ingestionStatus: string | null;
  lastError: string | null;
};
type VersionText = {
  status: string;
  preview: string;
  extractedAt: string;
  errorMessage: string | null;
  extractor: string;
} | null;
type Version = { id: string; versionNumber: number; documents: Doc[]; versionText: VersionText };
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

function IngestionBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const variant =
    status === "TEXT_READY"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : status === "ERROR"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${variant}`}>
      {status}
    </span>
  );
}

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
  const [uploadForm, setUploadForm] = useState<{ versionId: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extractingVersionId, setExtractingVersionId] = useState<string | null>(null);
  const [expandedTextVersionId, setExpandedTextVersionId] = useState<string | null>(null);
  const [fullTextCache, setFullTextCache] = useState<Record<string, string>>({});
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

  async function uploadDocument(versionId: string) {
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
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setUploadForm(null);
      setFile(null);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function extractText(versionId: string) {
    if (!canMutate) return;
    setError(null);
    setExtractingVersionId(versionId);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/extract-text`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extract failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setExtractingVersionId(null);
    }
  }

  async function loadFullText(versionId: string) {
    if (fullTextCache[versionId]) {
      setExpandedTextVersionId(versionId);
      return;
    }
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/versions/${versionId}/text?limit=50000`
      );
      const data = await res.json();
      if (res.ok && typeof data.fullText === "string") {
        setFullTextCache((prev) => ({ ...prev, [versionId]: data.fullText }));
        setExpandedTextVersionId(versionId);
      }
    } catch {
      setError("Failed to load full text");
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
          {payload.versions.map((v) => {
            const hasDoc = v.documents.length > 0;
            const doc = v.documents[0] ?? null;
            const versionText = v.versionText;
            const isExpanded = expandedTextVersionId === v.id;
            const fullText = fullTextCache[v.id];
            return (
              <div key={v.id} className="rounded-lg border p-4 space-y-3">
                <p className="font-medium">Version {v.versionNumber}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {!hasDoc ? (
                    <li>No document</li>
                  ) : (
                    doc && (
                      <li className="flex items-center gap-2 flex-wrap">
                        <span>{doc.originalName}</span>
                        {doc.size != null && <span>({doc.size} bytes)</span>}
                        <IngestionBadge status={doc.ingestionStatus} />
                        {doc.lastError && (
                          <span className="text-destructive text-xs">{doc.lastError}</span>
                        )}
                      </li>
                    )
                  )}
                </ul>

                {/* Extract text */}
                {hasDoc && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => extractText(v.id)}
                      disabled={!canMutate || extractingVersionId !== null}
                    >
                      {extractingVersionId === v.id ? "Extracting…" : "Extract text"}
                    </Button>
                  </div>
                )}

                {/* Text preview / error */}
                {versionText && (
                  <div className="rounded border bg-muted/30 p-3 text-sm space-y-2">
                    {versionText.status === "ERROR" && versionText.errorMessage && (
                      <p className="text-destructive font-medium">
                        Extraction error: {versionText.errorMessage}
                      </p>
                    )}
                    {versionText.status === "TEXT_READY" && (
                      <>
                        <p className="text-muted-foreground text-xs">
                          Extracted at {new Date(versionText.extractedAt).toLocaleString()}
                          {versionText.extractor && ` · ${versionText.extractor}`}
                        </p>
                        {isExpanded && fullText !== undefined ? (
                          <div className="whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                            {fullText}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {versionText.preview}
                            {versionText.preview.length >= 500 && "…"}
                          </div>
                        )}
                        {versionText.preview.length >= 500 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => (isExpanded ? setExpandedTextVersionId(null) : loadFullText(v.id))}
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Upload (real file) */}
                {canMutate && (
                  <div className="pt-2">
                    {uploadForm?.versionId === v.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <Label className="text-sm">File</Label>
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
                          onClick={() => uploadDocument(v.id)}
                          disabled={uploading || !file}
                        >
                          {uploading ? "Uploading…" : "Upload"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUploadForm(null);
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
                        onClick={() => setUploadForm({ versionId: v.id })}
                        disabled={hasDoc}
                      >
                        {hasDoc ? "Document attached" : "Upload file"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
