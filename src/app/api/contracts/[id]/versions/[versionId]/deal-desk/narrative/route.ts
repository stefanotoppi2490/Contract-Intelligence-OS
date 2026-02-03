import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as dealDecisionRepo from "@/core/db/repositories/dealDecisionRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import {
  generateExecutiveNarrative,
  buildExecutiveNarrativeInput,
} from "@/core/services/reports/executiveNarrativeAI";

const bodySchema = z.object({ policyId: z.string().min(1) });

/** POST: generate AI executive narrative from structured data only. Optionally store on DealDecision (draft). LEGAL/RISK/ADMIN. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
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
    const aggregation = await aggregateRisk({
      contractId,
      contractVersionId: versionId,
      policyId,
    });
    if (!aggregation) {
      return NextResponse.json(
        { error: "MISSING_ANALYSIS", message: "Run analysis first." },
        { status: 409 }
      );
    }
    const policyName =
      (version as { contractCompliance?: Array<{ policyId: string; policy: { name: string } }> }).contractCompliance?.find(
        (cc) => cc.policyId === policyId
      )?.policy?.name ?? "Policy";
    const title = (contract as { title: string }).title;
    const input = buildExecutiveNarrativeInput(aggregation, title, policyName);
    const narrative = await generateExecutiveNarrative(input, aggregation);
    const decision = await dealDecisionRepo.findDealDecisionByVersionAndPolicy(versionId, policyId);
    if (decision?.status === "DRAFT") {
      await dealDecisionRepo.updateDealDecisionExecutiveSummary(versionId, policyId, narrative);
    }
    return NextResponse.json({ narrative });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
