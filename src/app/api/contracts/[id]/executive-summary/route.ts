import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";
import { buildExecutiveSummary } from "@/core/services/risk/executiveSummary";
import { findApprovedExceptionsWithTitlesByContractVersion } from "@/core/db/repositories/exceptionRepo";

type ContractDetail = Awaited<ReturnType<typeof contractRepo.getContractDetail>>;
type VersionWithCompliance = {
  id: string;
  versionNumber: number;
  contractCompliance: Array<{ policyId: string; policy: { id: string; name: string } }>;
};

/** GET: return export-ready executive summary model. VIEWER can read. Narrative not included (generate on export). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id: contractId } = await params;
    const url = new URL(req.url);
    const policyId = url.searchParams.get("policyId")?.trim() ?? "";
    const versionId = url.searchParams.get("versionId")?.trim() ?? "";
    if (!policyId || !versionId) {
      return NextResponse.json(
        { error: "Missing policyId or versionId" },
        { status: 400 }
      );
    }
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const c = contract as unknown as ContractDetail & {
      versions: Array<VersionWithCompliance & { contract?: { startDate?: Date; endDate?: Date } }>;
    };
    const version = c.versions.find((v) => v.id === versionId);
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
        { error: "No compliance record for this version and policy. Run analysis first." },
        { status: 404 }
      );
    }
    const summary = buildExecutiveSummary(aggregation);
    const [workspace, exceptions] = await Promise.all([
      workspaceRepo.findWorkspaceById(workspaceId),
      findApprovedExceptionsWithTitlesByContractVersion(versionId),
    ]);
    const policyName =
      version.contractCompliance?.find((cc) => cc.policyId === policyId)?.policy?.name ?? "Policy";
    const contractWithDates = contract as { startDate?: Date | null; endDate?: Date | null };
    return NextResponse.json({
      contract: {
        title: c.title,
        counterpartyName: (c as { counterparty?: { name: string } }).counterparty?.name ?? "",
        contractType: (c as { contractType?: string | null }).contractType ?? null,
        startDate: contractWithDates.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: contractWithDates.endDate?.toISOString().slice(0, 10) ?? null,
      },
      version: { id: version.id, versionNumber: version.versionNumber },
      policyName,
      summary: {
        decision: summary.headline,
        overallStatus: aggregation.overallStatus,
        rawScore: aggregation.rawScore,
        effectiveScore: aggregation.effectiveScore,
        clusters: aggregation.clusters.map((x) => ({
          riskType: x.riskType,
          level: x.level,
          violations: x.violationCount,
          unclear: x.unclearCount,
        })),
        keyRisks: aggregation.topDrivers.slice(0, 5).map((d) => `${d.clauseType}: ${d.reason}`),
      },
      narrative: null,
      exceptions: {
        count: exceptions.length,
        items: exceptions.map((e) => ({ id: e.id, title: e.title })),
      },
      generatedAt: aggregation.generatedAt,
      workspaceName: workspace?.name ?? "",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
