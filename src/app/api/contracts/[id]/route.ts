import { NextResponse } from "next/server";
import type { ContractType, ContractStatus } from "@prisma/client";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import { updateContractSchema } from "@/lib/validations/contract";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { id } = await params;
    const contract = await contractRepo.getContractDetail(id);
    if (!contract || contract.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    return NextResponse.json(contract);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id } = await params;
    const existing = await contractRepo.findContractById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const body = await req.json();
    const parsed = updateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    type UpdateData = Parameters<typeof contractRepo.updateContract>[1];
    const updateData: UpdateData = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.contractType !== undefined)
      updateData.contractType = parsed.data.contractType as ContractType | null;
    if (parsed.data.counterpartyId !== undefined)
      updateData.counterparty = { connect: { id: parsed.data.counterpartyId } };
    if (parsed.data.status !== undefined)
      updateData.status = parsed.data.status as ContractStatus;
    if (parsed.data.startDate !== undefined)
      updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    if (parsed.data.endDate !== undefined)
      updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    const updated = await contractRepo.updateContract(id, updateData);
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "contract.updated",
      actorUserId: session.userId,
      payload: { contractId: id, updates: parsed.data },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id } = await params;
    const existing = await contractRepo.findContractById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    await contractRepo.deleteContract(id);
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "contract.deleted",
      actorUserId: session.userId,
      payload: { contractId: id, title: existing.title },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
