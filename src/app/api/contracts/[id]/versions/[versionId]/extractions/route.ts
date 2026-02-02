import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as clauseExtractionRepo from "@/core/db/repositories/clauseExtractionRepo";

/** GET: list AI clause extractions for a contract version. RBAC: VIEWER can read. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId, versionId } = await params;

    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const extractions = await clauseExtractionRepo.findManyByContractVersion(versionId);
    return NextResponse.json(
      extractions.map((e) => ({
        id: e.id,
        clauseType: e.clauseType,
        extractedValue: e.extractedValue,
        extractedText: e.extractedText,
        confidence: e.confidence,
        sourceLocation: e.sourceLocation,
        extractedBy: e.extractedBy,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
