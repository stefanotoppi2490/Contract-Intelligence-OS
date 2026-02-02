import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { updatePolicyRuleSchema } from "@/lib/validations/policy";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";

/** PATCH: update a rule. RBAC: LEGAL/RISK/ADMIN. Workspace-scoped. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ policyId: string; ruleId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const { policyId, ruleId } = await params;
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const rule = await policyRuleRepo.findPolicyRuleById(ruleId);
    if (!rule || rule.policyId !== policyId) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = updatePolicyRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const updated = await policyRuleRepo.updatePolicyRule(ruleId, {
      ...(data.clauseType !== undefined && { clauseType: data.clauseType }),
      ...(data.ruleType !== undefined && { ruleType: data.ruleType }),
      ...(data.expectedValue !== undefined && { expectedValue: data.expectedValue as object | null }),
      ...(data.severity !== undefined && { severity: data.severity }),
      ...(data.riskType !== undefined && { riskType: data.riskType }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.recommendation !== undefined && { recommendation: data.recommendation }),
    });
    return NextResponse.json({
      id: updated.id,
      clauseType: updated.clauseType,
      ruleType: updated.ruleType,
      expectedValue: updated.expectedValue,
      severity: updated.severity,
      riskType: updated.riskType,
      weight: updated.weight,
      recommendation: updated.recommendation,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** DELETE: remove a rule. RBAC: LEGAL/RISK/ADMIN. Workspace-scoped. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ policyId: string; ruleId: string }> }
) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    requireRole(session, { allowedRoles: ["LEGAL", "RISK", "ADMIN"] });
    const workspaceId = session.currentWorkspaceId!;
    const { policyId, ruleId } = await params;
    const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    const rule = await policyRuleRepo.findPolicyRuleById(ruleId);
    if (!rule || rule.policyId !== policyId) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    await policyRuleRepo.deletePolicyRule(ruleId);
    return NextResponse.json({ deleted: true, id: ruleId });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
