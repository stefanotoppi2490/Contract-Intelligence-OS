import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { getTextQuerySchema } from "@/lib/validations/document";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as contractVersionTextRepo from "@/core/db/repositories/contractVersionTextRepo";

const DEFAULT_PREVIEW_LENGTH = 500;
const MAX_FULL_TEXT = 50_000;

/** GET: status + preview + extractedAt + errorMessage; optional full text with limit. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;
    const url = new URL(req.url);
    const queryParsed = getTextQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    const limit = queryParsed.success ? queryParsed.data.limit : 2000;

    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const versionText = await contractVersionTextRepo.findContractVersionTextByVersionId(versionId);
    if (!versionText) {
      return NextResponse.json({
        status: null,
        preview: null,
        fullText: null,
        extractedAt: null,
        errorMessage: null,
        extractor: null,
      });
    }
    const preview =
      versionText.text.length <= DEFAULT_PREVIEW_LENGTH
        ? versionText.text
        : versionText.text.slice(0, DEFAULT_PREVIEW_LENGTH);
    const fullText =
      limit > 0 && versionText.text.length <= Math.min(limit, MAX_FULL_TEXT)
        ? versionText.text
        : versionText.text.length > 0
          ? versionText.text.slice(0, Math.min(limit, MAX_FULL_TEXT))
          : undefined;
    return NextResponse.json({
      status: versionText.status,
      preview,
      fullText,
      extractedAt: versionText.extractedAt.toISOString(),
      errorMessage: versionText.errorMessage ?? null,
      extractor: versionText.extractor,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
