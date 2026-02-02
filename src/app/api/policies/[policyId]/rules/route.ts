import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { createPolicyRuleSchema } from "@/lib/validations/policy";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";
import { recordEvent } from "@/core/services/ledger/ledgerService";

/** POST: create a rule for the policy. RBAC: LEGAL/RISK/ADMIN. Workspace-scoped. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const { policyId } = await params;
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = createPolicyRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const createData = {
      policy: { connect: { id: policyId } },
      clauseType: data.clauseType,
      ruleType: data.ruleType,
      expectedValue:
        data.expectedValue === null || data.expectedValue === undefined
          ? undefined
          : (data.expectedValue as Prisma.InputJsonValue),
      severity: data.severity ?? undefined,
      riskType: data.riskType ?? undefined,
      weight: data.weight,
      recommendation: data.recommendation,
    } as Prisma.PolicyRuleCreateInput;
    const rule = await policyRuleRepo.createPolicyRule(createData);
    await recordEvent({
      workspaceId,
      actorUserId: session.userId,
      type: "POLICY_RULE_CREATED",
      entityType: "PolicyRule",
      entityId: rule.id,
      policyId: policyId,
      metadata: { clauseType: rule.clauseType, ruleType: rule.ruleType, weight: rule.weight },
    });
    return NextResponse.json({
      id: rule.id,
      clauseType: rule.clauseType,
      ruleType: rule.ruleType,
      expectedValue: rule.expectedValue,
      severity: rule.severity,
      riskType: rule.riskType,
      weight: rule.weight,
      recommendation: "recommendation" in rule ? (rule as { recommendation: string }).recommendation : null,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
