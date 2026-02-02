/**
 * STEP 8B: Manual (re-)run of AI clause extraction for a version.
 * RBAC: LEGAL/RISK/ADMIN. Requires ContractVersionText TEXT_READY.
 * Records ledger event with metadata: versionId, extractedCount, avgConfidence, model.
 */

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as contractVersionTextRepo from "@/core/db/repositories/contractVersionTextRepo";
import * as clauseExtractionRepo from "@/core/db/repositories/clauseExtractionRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";
import { extractClausesNeutral } from "@/core/services/extraction/aiClauseExtractor";
import { getGeminiModel } from "@/core/services/ai/geminiClient";

/** getContractDetail includes versions; Prisma inference can omit it. */
type ContractWithVersions = { versions: { id: string }[] };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;

    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const withVersions = contract as unknown as ContractWithVersions;
    const version = withVersions.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const versionText = await contractVersionTextRepo.findContractVersionTextByVersionId(versionId);
    if (!versionText || versionText.status !== "TEXT_READY") {
      return NextResponse.json(
        { error: "Contract text not ready. Extract text first." },
        { status: 400 }
      );
    }

    const extractions = await extractClausesNeutral(versionText.text);
    const extractedCount = extractions.length;
    const avgConfidence =
      extractedCount > 0
        ? extractions.reduce((s, e) => s + e.confidence, 0) / extractedCount
        : 0;
    const model = getGeminiModel();

    if (extractedCount > 0) {
      await clauseExtractionRepo.replaceExtractionsForVersion(
        workspaceId,
        contractId,
        versionId,
        extractions.map((e) => ({
          clauseType: e.clauseType,
          extractedValue: e.extractedValue as Prisma.InputJsonValue,
          extractedText: e.extractedText,
          confidence: e.confidence,
          sourceLocation: (e.sourceLocation ?? undefined) as Prisma.InputJsonValue | undefined,
        }))
      );
    }

    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "TEXT_EXTRACTED",
      entityType: "ClauseExtraction",
      entityId: versionId,
      contractId,
      contractVersionId: versionId,
      metadata: {
        versionId,
        extractedCount,
        avgConfidence,
        model,
      },
    });

    return NextResponse.json({
      versionId,
      extractedCount,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      model,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
