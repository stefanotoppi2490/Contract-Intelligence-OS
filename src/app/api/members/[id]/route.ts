import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import { updateMemberSchema } from "@/lib/validations/member";
import * as membershipRepo from "@/core/db/repositories/membershipRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";
import { hasMinRole } from "@/core/services/security/rbac";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { minRole: "ADMIN" });
    const { id: membershipId } = await params;
    const body = await req.json();
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { role: newRole } = parsed.data;
    const workspaceId = session.currentWorkspaceId!;
    const membership = await membershipRepo.findMembershipById(membershipId);
    if (!membership || membership.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    const isAdmin = hasMinRole(membership.role, "ADMIN");
    if (isAdmin) {
      const adminCount = await membershipRepo.countAdminsByWorkspace(workspaceId);
      if (adminCount <= 1) {
        const wouldDemote = !hasMinRole(newRole, "ADMIN");
        if (wouldDemote) {
          return NextResponse.json(
            { error: "Cannot demote the last admin" },
            { status: 400 }
          );
        }
      }
    }
    await membershipRepo.updateMembership(membershipId, { role: newRole });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "membership.role_updated",
      actorUserId: session.userId,
      payload: {
        membershipId,
        userId: membership.userId,
        previousRole: membership.role,
        newRole,
      },
    });
    return NextResponse.json({ role: newRole });
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
    requireRole(session, { minRole: "ADMIN" });
    const { id: membershipId } = await params;
    const workspaceId = session.currentWorkspaceId!;
    const membership = await membershipRepo.findMembershipById(membershipId);
    if (!membership || membership.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    const isAdmin = hasMinRole(membership.role, "ADMIN");
    if (isAdmin) {
      const adminCount = await membershipRepo.countAdminsByWorkspace(workspaceId);
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin" },
          { status: 400 }
        );
      }
    }
    await membershipRepo.deleteMembership(membershipId);
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "membership.removed",
      actorUserId: session.userId,
      payload: { membershipId, userId: membership.userId, role: membership.role },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
