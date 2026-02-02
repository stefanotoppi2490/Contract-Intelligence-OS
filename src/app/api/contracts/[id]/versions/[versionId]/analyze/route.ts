import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { analyzeBodySchema } from "@/lib/validations/compliance";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";
import { analyze, MissingExtractionsError } from "@/core/services/policyEngine/policyEngine";

/** getContractDetail includes versions; Prisma inference can omit it. */
type ContractWithVersions = { versions: { id: string }[] };

/** POST: run deterministic policy analysis for this version + policy. RBAC: LEGAL/RISK/ADMIN. */
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
    const body = await req.json().catch(() => ({}));
    const parsed = analyzeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const policy = await policyRepo.findPolicyById(parsed.data.policyId);
    if (!policy || policy.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const result = await analyze({ contractVersionId: versionId, policyId: policy.id });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "contract.analyzed",
      actorUserId: session.userId,
      payload: {
        contractId,
        versionId,
        policyId: policy.id,
        score: result.score,
        status: result.status,
        violationsCount: result.violationsCount,
      },
    });
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "ANALYSIS_RUN",
      entityType: "ContractCompliance",
      entityId: versionId,
      contractId,
      contractVersionId: versionId,
      policyId: policy.id,
      metadata: {
        policyId: policy.id,
        rawScore: result.score,
        effectiveScore: result.score,
        violationsCount: result.violationsCount,
        ...(result.mode === "EVALUATE_EXTRACTED_CLAUSES"
          ? { mode: "EVALUATE_EXTRACTED_CLAUSES" as const }
          : {}),
        ...(result.unclear && result.unclear.length > 0
          ? { unclear: result.unclear }
          : {}),
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof MissingExtractionsError) {
      return NextResponse.json(
        { code: e.code, error: e.message },
        { status: 409 }
      );
    }
    if (e instanceof Error && e.message === "Policy not found") {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof Error && e.message.includes("Contract text not ready")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
