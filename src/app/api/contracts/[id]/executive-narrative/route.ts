import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import {
  generateExecutiveNarrative,
  buildExecutiveNarrativeInput,
} from "@/core/services/reports/executiveNarrativeAI";

type ContractWithVersions = {
  id: string;
  title: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    contractCompliance: Array<{ policyId: string; policy: { id: string; name: string } }>;
  }>;
};

/** POST: generate AI executive narrative. Body: { policyId, versionId? }. VIEWER allowed. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId } = await params;
    const body = await req.json().catch(() => ({}));
    const policyId = typeof body.policyId === "string" ? body.policyId.trim() : "";
    const versionId = typeof body.versionId === "string" ? body.versionId.trim() : null;
    if (!policyId) {
      return NextResponse.json({ error: "Missing policyId" }, { status: 400 });
    }
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const c = contract as unknown as ContractWithVersions;
    const version = versionId
      ? c.versions.find((v) => v.id === versionId)
      : [...c.versions]
          .reverse()
          .find((v) => v.contractCompliance?.some((cc) => cc.policyId === policyId));
    if (!version) {
      return NextResponse.json(
        { error: "No analyzed version found for this policy. Run analysis first." },
        { status: 404 }
      );
    }
    const aggregation = await aggregateRisk({
      contractId,
      contractVersionId: version.id,
      policyId,
    });
    if (!aggregation) {
      return NextResponse.json(
        { error: "No compliance record for this version and policy." },
        { status: 404 }
      );
    }
    const policyName =
      version.contractCompliance?.find((cc) => cc.policyId === policyId)?.policy?.name ?? "Policy";
    const input = buildExecutiveNarrativeInput(aggregation, c.title, policyName);
    const narrative = await generateExecutiveNarrative(input, aggregation);
    return NextResponse.json({ narrative });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
