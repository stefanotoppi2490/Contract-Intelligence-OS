import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { PoliciesClient } from "./PoliciesClient";

export const dynamic = "force-dynamic";

type PolicyRuleRow = {
  id: string;
  clauseType: string;
  ruleType: string;
  expectedValue: unknown;
  severity: string | null;
  riskType: string | null;
  weight: number;
  recommendation: string | null;
};

type PolicyWithRules = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  rules: PolicyRuleRow[];
};

export default async function PoliciesPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const policies = (await policyRepo.findManyPoliciesByWorkspace(workspaceId, {
    include: { rules: true },
  })) as unknown as PolicyWithRules[];
  const canManage = ["LEGAL", "RISK", "ADMIN"].includes(session.role ?? "");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Policies</h1>
        <p className="text-muted-foreground">
          Define policies and rules for contract analysis. Use a policy when analyzing a contract version.
        </p>
      </div>
      <PoliciesClient
        policies={policies.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          isActive: p.isActive,
          rules: p.rules.map((r) => ({
            id: r.id,
            clauseType: r.clauseType,
            ruleType: r.ruleType,
            expectedValue: r.expectedValue,
            severity: r.severity,
            riskType: r.riskType,
            weight: r.weight,
            recommendation: r.recommendation ?? "",
          })),
        }))}
        canManage={canManage}
      />
    </div>
  );
}
