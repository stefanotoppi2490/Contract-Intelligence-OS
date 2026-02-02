import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { createExceptionSchema } from "@/lib/validations/exception";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** getContractDetail includes versions; Prisma inference can omit it. */
type ContractWithVersions = { versions: { id: string }[] };

/** POST: create exception request for this version. RBAC: LEGAL/RISK/ADMIN. Dedupe: 409 if active exception exists for same finding or (version, policy, title). */
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
    const parsed = createExceptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { clauseFindingId, policyId, title, justification } = parsed.data;

    let clauseType: string | null = null;
    let effectivePolicyId: string | null = policyId ?? null;

    if (clauseFindingId) {
      const finding = await clauseFindingRepo.findClauseFindingById(clauseFindingId);
      if (!finding || finding.contractVersionId !== versionId) {
        return NextResponse.json({ error: "Clause finding not found or does not belong to this version" }, { status: 404 });
      }
      clauseType = finding.clauseType;
      effectivePolicyId = finding.rule?.policyId ?? effectivePolicyId;

      const existing = await exceptionRepo.findActiveExceptionByClauseFindingId(clauseFindingId);
      if (existing) {
        return NextResponse.json(
          { error: "An active exception already exists for this finding", existingExceptionId: existing.id },
          { status: 409 }
        );
      }
    } else {
      if (!effectivePolicyId) {
        return NextResponse.json(
          { error: "policyId is required when clauseFindingId is not provided" },
          { status: 400 }
        );
      }
      const existing = await exceptionRepo.findRequestedExceptionByVersionPolicyTitle(
        versionId,
        effectivePolicyId,
        title
      );
      if (existing) {
        return NextResponse.json(
          { error: "A requested exception already exists for this version, policy, and title", existingExceptionId: existing.id },
          { status: 409 }
        );
      }
    }

    const exception = await exceptionRepo.createExceptionRequest({
      workspace: { connect: { id: workspaceId } },
      contractVersion: { connect: { id: versionId } },
      contractId,
      title,
      justification,
      requestedByUserId: session.userId,
      status: "REQUESTED",
      ...(clauseFindingId && { clauseFinding: { connect: { id: clauseFindingId } } }),
      ...(effectivePolicyId && { policy: { connect: { id: effectivePolicyId } } }),
      ...(clauseType && { clauseType }),
    });
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "EXCEPTION_REQUESTED",
      entityType: "ExceptionRequest",
      entityId: exception.id,
      contractId,
      contractVersionId: versionId,
      policyId: effectivePolicyId ?? undefined,
      exceptionId: exception.id,
      metadata: { clauseType: clauseType ?? undefined, title },
    });
    return NextResponse.json({
      id: exception.id,
      contractVersionId: versionId,
      clauseFindingId: exception.clauseFindingId,
      policyId: exception.policyId,
      clauseType: exception.clauseType,
      title: exception.title,
      status: exception.status,
      createdAt: exception.createdAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
