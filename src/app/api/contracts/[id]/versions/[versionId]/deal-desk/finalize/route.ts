import type { LedgerEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";
import { recordEvent } from "@/core/services/ledger/ledgerService";

const bodySchema = z.object({ policyId: z.string().min(1) });

/** POST: set DealDecision status=FINAL. Idempotent. If no decision exists, create from engine then finalize. LEGAL/RISK/ADMIN only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const userId = session.userId!;
    const { id: contractId, versionId } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const { policyId } = parsed.data;
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    let decision = await dealDecisionRepo.findDealDecisionByVersionAndPolicy(versionId, policyId);
    let didFinalize = false;
    let effectiveScoreForLedger: number | undefined;
    if (!decision) {
      const preview = await computeDealDecisionPreview(contractId, versionId, policyId);
      if (!preview) {
        return NextResponse.json(
          { error: "MISSING_ANALYSIS", message: "Run analysis first." },
          { status: 409 }
        );
      }
      decision = await dealDecisionRepo.createDealDecision({
        workspaceId,
        contractId,
        contractVersionId: versionId,
        policyId,
        status: "FINAL",
        outcome: preview.outcome,
        rationale: preview.rationaleMarkdown,
        createdByUserId: userId,
        finalizedByUserId: userId,
        finalizedAt: new Date(),
      });
      didFinalize = true;
      effectiveScoreForLedger = preview.effectiveScore;
    } else if (decision.status === "DRAFT") {
      const preview = await computeDealDecisionPreview(contractId, versionId, policyId);
      effectiveScoreForLedger = preview?.effectiveScore;
      await dealDecisionRepo.finalizeDealDecision(versionId, policyId, userId);
      decision = await dealDecisionRepo.findDealDecisionByVersionAndPolicy(versionId, policyId);
      didFinalize = true;
    }
    if (didFinalize && decision) {
      await recordEvent({
        workspaceId,
        actorUserId: userId,
        type: "DEAL_DECISION_FINALIZED" as LedgerEventType,
        entityType: "DealDecision",
        entityId: decision.id,
        contractId,
        contractVersionId: versionId,
        policyId,
        metadata: {
          outcome: decision.outcome,
          effectiveScore: effectiveScoreForLedger,
        },
      });
    }
    const current = await dealDecisionRepo.findDealDecisionByVersionAndPolicy(versionId, policyId);
    return NextResponse.json({
      id: current?.id,
      status: current?.status,
      outcome: current?.outcome,
      finalizedAt: current?.finalizedAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
