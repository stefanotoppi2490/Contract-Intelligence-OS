import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { compareVersions } from "@/core/services/compare/versionCompare";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** GET: compare two versions for a contract and policy. Query: fromVersionId, toVersionId, policyId. RBAC: any role. */
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
    const fromVersionId = url.searchParams.get("fromVersionId") ?? "";
    const toVersionId = url.searchParams.get("toVersionId") ?? "";
    const policyId = url.searchParams.get("policyId") ?? "";
    if (!fromVersionId || !toVersionId || !policyId) {
      return NextResponse.json(
        { error: "Missing fromVersionId, toVersionId, or policyId" },
        { status: 400 }
      );
    }
    const contract = await contractRepo.getContractDetail(contractId, workspaceId);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const fromVersion = contract.versions.find((v) => v.id === fromVersionId);
    const toVersion = contract.versions.find((v) => v.id === toVersionId);
    if (!fromVersion || !toVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    if (!outcome.ok) {
      return NextResponse.json(
        { error: "Missing analysis for version", code: outcome.code, missingVersionId: outcome.missingVersionId },
        { status: 409 }
      );
    }
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "VERSION_COMPARED",
      entityType: "VersionComparison",
      entityId: `${fromVersionId}-${toVersionId}`,
      contractId,
      contractVersionId: toVersionId,
      policyId,
      metadata: {
        fromVersionId,
        toVersionId,
        fromVersionNumber: outcome.result.from.versionNumber,
        toVersionNumber: outcome.result.to.versionNumber,
        policyId,
        effectiveDelta: outcome.result.delta.effective,
        label: outcome.result.delta.label,
      },
    });
    return NextResponse.json(outcome.result);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Error && e.message === "Contract not found") {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
