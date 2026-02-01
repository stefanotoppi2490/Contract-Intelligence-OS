import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { analyzeBodySchema } from "@/lib/validations/compliance";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";
import { analyze } from "@/core/services/policyEngine/policyEngine";

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
    const version = contract.versions.find((v) => v.id === versionId);
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
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Error && e.message === "Policy not found") {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
