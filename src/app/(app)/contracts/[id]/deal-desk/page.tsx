import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { DealDeskClient } from "./DealDeskClient";

export const dynamic = "force-dynamic";

export default async function DealDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ versionId?: string; policyId?: string }>;
}) {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const { id } = await params;
  const { versionId: qVersionId, policyId: qPolicyId } = await searchParams;
  const [contract, policies] = await Promise.all([
    contractRepo.getContractDetail(id, workspaceId),
    policyRepo.findManyPoliciesByWorkspace(workspaceId),
  ]);
  if (!contract) notFound();
  const versions = contract.versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
  }));
  const canMutate = ["LEGAL", "RISK", "ADMIN"].includes(session.role ?? "");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${contract.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {contract.title}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-semibold">Deal Desk</h1>
        </div>
      </div>
      <DealDeskClient
        contractId={contract.id}
        contractTitle={contract.title}
        counterpartyName={contract.counterparty.name}
        versions={versions}
        policies={policies.map((p) => ({ id: p.id, name: p.name }))}
        initialVersionId={qVersionId ?? null}
        initialPolicyId={qPolicyId ?? null}
        canMutate={canMutate}
      />
    </div>
  );
}
