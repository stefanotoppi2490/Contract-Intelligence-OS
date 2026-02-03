import type { LedgerEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";
import { recordEvent } from "@/core/services/ledger/ledgerService";

const bodySchema = z.object({
  policyId: z.string().min(1),
  executiveSummary: z.string().optional().nullable(),
});

/** POST: create or update DealDecision as DRAFT. LEGAL/RISK/ADMIN only. */
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
    const { policyId, executiveSummary } = parsed.data;
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const version = contract.versions.find((v) => v.id === versionId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const preview = await computeDealDecisionPreview(contractId, versionId, policyId);
    if (!preview) {
      return NextResponse.json(
        { error: "MISSING_ANALYSIS", message: "Run analysis first." },
        { status: 409 }
      );
    }
    const decision = await dealDecisionRepo.upsertDealDecisionDraft({
      workspaceId,
      contractId,
      contractVersionId: versionId,
      policyId,
      outcome: preview.outcome,
      rationale: preview.rationaleMarkdown,
      executiveSummary: executiveSummary ?? null,
      createdByUserId: userId,
    });
    await recordEvent({
      workspaceId,
      actorUserId: userId,
      type: "DEAL_DECISION_DRAFTED" as LedgerEventType,
      entityType: "DealDecision",
      entityId: decision.id,
      contractId,
      contractVersionId: versionId,
      policyId,
      metadata: {
        outcome: preview.outcome,
        effectiveScore: preview.effectiveScore,
        violations: preview.counts.violations,
        unclear: preview.counts.unclear,
      },
    });
    return NextResponse.json({
      id: decision.id,
      status: decision.status,
      outcome: decision.outcome,
      rationale: decision.rationale,
      executiveSummary: decision.executiveSummary,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
