import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace, getCurrentWorkspaceCookieName } from "@/core/services/security/auth";
import { requireAuth, AuthError } from "@/core/services/security/rbac";
import { selectWorkspaceSchema } from "@/lib/validations/workspace";
import { findMembershipByWorkspaceAndUser } from "@/core/db/repositories/membershipRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireAuth(session);
    const body = await req.json();
    const parsed = selectWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { workspaceId } = parsed.data;
    const membership = await findMembershipByWorkspaceAndUser(workspaceId, session.userId);
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "workspace.selected",
      actorUserId: session.userId,
      payload: { workspaceId, userId: session.userId },
    });
    const res = NextResponse.json({ workspaceId });
    const cookieName = getCurrentWorkspaceCookieName();
    res.cookies.set(cookieName, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
