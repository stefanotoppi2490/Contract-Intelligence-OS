import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { createPolicySchema } from "@/lib/validations/policy";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";

/** GET: list active policies for current workspace. */
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
        rulesCount: p.rules?.length ?? 0,
      }))
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** POST: create policy with default rules. RBAC: LEGAL/RISK/ADMIN. */
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
    const { name, description } = parsed.data;
    const policy = await policyRepo.createPolicy({
      workspace: { connect: { id: workspaceId } },
      name,
      description: description ?? null,
      isActive: true,
    });
    // Default rules so findings appear when analyzing
    await policyRuleRepo.createPolicyRule({
      policy: { connect: { id: policy.id } },
      clauseType: "TERMINATION",
      ruleType: "REQUIRED",
      severity: "MEDIUM",
      riskType: "LEGAL",
      weight: 5,
    });
    await policyRuleRepo.createPolicyRule({
      policy: { connect: { id: policy.id } },
      clauseType: "LIABILITY",
      ruleType: "REQUIRED",
      severity: "HIGH",
      riskType: "LEGAL",
      weight: 7,
    });
    await policyRuleRepo.createPolicyRule({
      policy: { connect: { id: policy.id } },
      clauseType: "CONFIDENTIALITY",
      ruleType: "REQUIRED",
      severity: "MEDIUM",
      riskType: "LEGAL",
      weight: 5,
    });
    return NextResponse.json({
      id: policy.id,
      name: policy.name,
      description: policy.description,
      isActive: policy.isActive,
      rulesCount: 3,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
