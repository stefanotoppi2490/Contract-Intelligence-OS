import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { computeDealDecisionPreview } from "@/core/services/dealDesk/dealDecisionEngine";

/** GET: deal-desk preview + existing decision + exceptions summary. VIEWER can read. 409 if missing analysis. */
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
    const policyId = url.searchParams.get("policyId")?.trim() ?? "";
    if (!policyId) {
      return NextResponse.json({ error: "Missing policyId" }, { status: 400 });
    }
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
        {
          error: "MISSING_ANALYSIS",
          message: "No compliance record for this version and policy. Run analysis first.",
        },
        { status: 409 }
      );
    }
    const [decision, exceptions] = await Promise.all([
      dealDecisionRepo.findDealDecisionByVersionAndPolicy(versionId, policyId),
      exceptionRepo.findManyExceptionRequestsByContractVersion(versionId, {
        where: { policyId },
        select: { id: true, title: true, status: true, clauseFindingId: true },
      }),
    ]);
    const openExceptions = exceptions.filter((e) => e.status === "REQUESTED");
    const approvedExceptions = exceptions.filter((e) => e.status === "APPROVED");
    return NextResponse.json({
      preview,
      decision: decision
        ? {
            id: decision.id,
            status: decision.status,
            outcome: decision.outcome,
            rationale: decision.rationale,
            executiveSummary: decision.executiveSummary,
            finalizedByUserId: decision.finalizedByUserId,
            finalizedAt: decision.finalizedAt?.toISOString() ?? null,
            policyName: decision.policy?.name,
          }
        : null,
      exceptionsSummary: {
        openCount: openExceptions.length,
        approvedCount: approvedExceptions.length,
        open: openExceptions.map((e) => ({ id: e.id, title: e.title })),
        approved: approvedExceptions.map((e) => ({ id: e.id, title: e.title })),
      },
      contract: {
        title: (contract as { title: string }).title,
        counterpartyName: (contract as { counterparty?: { name: string } }).counterparty?.name ?? "",
      },
      version: { id: version.id, versionNumber: (version as { versionNumber: number }).versionNumber },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET deal-desk error:", e);
    return NextResponse.json(
      { error: "Internal server error", message: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
