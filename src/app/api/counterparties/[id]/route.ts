import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import { updateCounterpartySchema } from "@/lib/validations/counterparty";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const { id } = await params;
    const existing = await counterpartyRepo.findCounterpartyById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
    }
    const body = await req.json();
    const parsed = updateCounterpartySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, type, notes } = parsed.data;
    if (name !== undefined && name !== existing.name) {
      const byName = await counterpartyRepo.findCounterpartyByWorkspaceAndName(workspaceId, name);
      if (byName) {
        return NextResponse.json(
          { error: "A counterparty with this name already exists in this workspace" },
          { status: 409 }
        );
      }
    }
    const updated = await counterpartyRepo.updateCounterparty(id, {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(notes !== undefined && { notes }),
    });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "counterparty.updated",
      actorUserId: session.userId,
      payload: { counterpartyId: id, updates: parsed.data },
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
    const existing = await counterpartyRepo.findCounterpartyById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
    }
    await counterpartyRepo.deleteCounterparty(id);
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "counterparty.deleted",
      actorUserId: session.userId,
      payload: { counterpartyId: id, name: existing.name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
