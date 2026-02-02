import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { createPolicySchema } from "@/lib/validations/policy";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";
import { seedDefaultPolicyRules } from "@/core/services/policyEngine/defaultPolicyRules";

/** GET: list policies with rules for current workspace. Any role with workspace. */
export async function GET() {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const policies = await policyRepo.findManyPoliciesByWorkspace(workspaceId);
    return NextResponse.json(
      policies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isActive: p.isActive,
        rules: (p.rules ?? []).map((r) => ({
          id: r.id,
          clauseType: r.clauseType,
          ruleType: r.ruleType,
          expectedValue: r.expectedValue,
          severity: r.severity,
          riskType: r.riskType,
          weight: r.weight,
          recommendation: "recommendation" in r ? (r as { recommendation: string }).recommendation : null,
        })),
      }))
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** POST: create policy. Body: { name, description?, seedDefaults?: boolean }. RBAC: LEGAL/RISK/ADMIN. */
export async function POST(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const body = await req.json().catch(() => ({}));
    const parsed = createPolicySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, description, seedDefaults } = parsed.data;
    const policy = await policyRepo.createPolicy({
      workspace: { connect: { id: workspaceId } },
      name,
      description: description ?? null,
      isActive: true,
    });
    let rulesCount = 0;
    if (seedDefaults !== false) {
      rulesCount = await seedDefaultPolicyRules(policy.id);
    }
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "POLICY_CREATED",
      entityType: "Policy",
      entityId: policy.id,
      policyId: policy.id,
      metadata: { name: policy.name, rulesCount },
    });
    return NextResponse.json({
      id: policy.id,
      name: policy.name,
      description: policy.description,
      isActive: policy.isActive,
      rulesCount,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
