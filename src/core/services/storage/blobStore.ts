/**
 * Vercel Blob storage wrapper: upload and download.
 * Requires BLOB_READ_WRITE_TOKEN when actually uploading; optional in dev (returns mock URL).
 */

import { put, del } from "@vercel/blob";

const ALLOWED_PREFIX = "https://";

/** Upload a buffer to Vercel Blob. Returns blob URL or throws. */
export async function uploadBlob(
  data: Buffer | Blob,
  pathname: string,
  options?: { contentType?: string; token?: string }
): Promise<{ url: string }> {
  const token = options?.token ?? process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for upload");
  }
  const blob = await put(pathname, data, {
    access: "public",
    contentType: options?.contentType ?? undefined,
    token,
  });
  return { url: blob.url };
}

/** Delete a blob by URL (optional; for cleanup). */
export async function deleteBlob(url: string, token?: string): Promise<void> {
  const t = token ?? process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) return;
  if (!url.startsWith(ALLOWED_PREFIX)) return;
  await del(url, { token: t });
}

/** Download blob content from a URL (e.g. Vercel Blob URL). Returns buffer. */
export async function downloadBlob(url: string): Promise<Buffer> {
  if (!url.startsWith(ALLOWED_PREFIX)) {
    throw new Error("Invalid blob URL");
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Blob download failed: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
