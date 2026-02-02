import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireAuth, AuthError } from "@/core/services/security/rbac";
import { createWorkspaceSchema } from "@/lib/validations/workspace";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import * as membershipRepo from "@/core/db/repositories/membershipRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { seedDefaultPolicyRules } from "@/core/services/policyEngine/defaultPolicyRules";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function GET() {
  try {
    const session = await getServerSessionWithWorkspace();
    requireAuth(session);
    const memberships = await membershipRepo.findManyMembershipsByUser(session.userId, {
      include: { workspace: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      workspaces: memberships.map((m) => {
        const w = (m as unknown as { workspace: { id: string; name: string } }).workspace;
        return { id: w.id, name: w.name, role: m.role };
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
    requireAuth(session);
    const body = await req.json();
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name } = parsed.data;
    const workspace = await workspaceRepo.createWorkspace({ name });
    const membership = await membershipRepo.createMembership({
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: session.userId } },
      role: "ADMIN",
    });
    // Seed default policy with meaningful rules (idempotent: one policy per workspace)
    const defaultPolicy = await policyRepo.createPolicy({
      workspace: { connect: { id: workspace.id } },
      name: "Default Company Standard",
      description: "Default policy created with the workspace. Add or edit rules in Policies.",
      isActive: true,
    });
    await seedDefaultPolicyRules(defaultPolicy.id);
    await createAuditEvent({
      workspace: { connect: { id: workspace.id } },
      eventType: "workspace.created",
      actorUserId: session.userId,
      payload: { workspaceId: workspace.id, name, createdBy: session.userId },
    });
    await createAuditEvent({
      workspace: { connect: { id: workspace.id } },
      eventType: "membership.created",
      actorUserId: session.userId,
      payload: {
        membershipId: membership.id,
        userId: session.userId,
        email: session.email,
        role: "ADMIN",
      },
    });
    return NextResponse.json({
      workspace: { id: workspace.id, name: workspace.name },
      role: "ADMIN",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
