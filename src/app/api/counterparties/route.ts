import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import { createCounterpartySchema } from "@/lib/validations/counterparty";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function GET(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const list = await counterpartyRepo.findManyCounterpartiesByWorkspace(workspaceId);
    return NextResponse.json({ counterparties: list });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const body = await req.json();
    const parsed = createCounterpartySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, type, notes } = parsed.data;
    const existing = await counterpartyRepo.findCounterpartyByWorkspaceAndName(workspaceId, name);
    if (existing) {
      return NextResponse.json(
        { error: "A counterparty with this name already exists in this workspace" },
        { status: 409 }
      );
    }
    const counterparty = await counterpartyRepo.createCounterparty({
      workspace: { connect: { id: workspaceId } },
      name,
      type,
      notes: notes ?? undefined,
    });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "counterparty.created",
      actorUserId: session.userId,
      payload: { counterpartyId: counterparty.id, name, type },
    });
    return NextResponse.json(counterparty);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
