import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import { addMemberSchema } from "@/lib/validations/member";
import * as userRepo from "@/core/db/repositories/userRepo";
import * as membershipRepo from "@/core/db/repositories/membershipRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function GET() {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const memberships = await membershipRepo.findManyMembershipsByWorkspace(
      session.currentWorkspaceId!,
      { include: { user: true }, orderBy: { createdAt: "asc" } }
    );
    return NextResponse.json({
      members: memberships.map((m) => {
        const u = (m as unknown as { user: { email: string; name: string | null } }).user;
        return {
          id: m.id,
          userId: m.userId,
          email: u.email,
          name: u.name,
          role: m.role,
          createdAt: m.createdAt,
        };
      }),
    });
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
    requireRole(session, { minRole: "ADMIN" });
    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { email, role } = parsed.data;
    const workspaceId = session.currentWorkspaceId!;
    const existingUser = await userRepo.findUserByEmail(email);
    if (existingUser) {
      const existingMembership = await membershipRepo.findMembershipByWorkspaceAndUser(
        workspaceId,
        existingUser.id
      );
      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this workspace" },
          { status: 409 }
        );
      }
      const membership = await membershipRepo.createMembership({
        workspace: { connect: { id: workspaceId } },
        user: { connect: { id: existingUser.id } },
        role,
      });
      await createAuditEvent({
        workspace: { connect: { id: workspaceId } },
        eventType: "membership.created",
        actorUserId: session.userId,
        payload: {
          membershipId: membership.id,
          userId: existingUser.id,
          email: existingUser.email,
          role,
          invitedBy: session.userId,
        },
      });
      return NextResponse.json({
        member: {
          id: membership.id,
          userId: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: membership.role,
        },
      });
    }
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "invitation.sent",
      actorUserId: session.userId,
      payload: { email, role, message: "User not yet registered; invitation recorded." },
    });
    return NextResponse.json({
      message: "Invitation sent. User will be added when they sign up.",
      email,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
