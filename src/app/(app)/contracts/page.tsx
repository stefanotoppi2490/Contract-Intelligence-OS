import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import { redirect } from "next/navigation";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { ContractsListClient } from "./ContractsListClient";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; contractType?: string; counterpartyId?: string }>;
}) {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const params = await searchParams;
  const filters =
    params.status || params.contractType || params.counterpartyId
      ? {
          status: params.status as "DRAFT" | "IN_REVIEW" | "SIGNED" | "ARCHIVED" | undefined,
          contractType: params.contractType as
            | "NDA"
            | "MSA"
            | "SOW"
            | "SLA"
            | "OTHER"
            | undefined,
          counterpartyId: params.counterpartyId,
        }
      : undefined;
  const contracts = await contractRepo.listContracts(workspaceId, filters);
  const counterparties = await counterpartyRepo.findManyCounterpartiesByWorkspace(workspaceId);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contracts</h1>
        <Link href="/contracts/new">
          <span className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            New contract
          </span>
        </Link>
      </div>
      <ContractsListClient
        contracts={contracts.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          contractType: c.contractType,
          counterpartyId: c.counterpartyId,
          counterpartyName: (c as { counterparty: { name: string } }).counterparty?.name ?? "",
          createdAt: c.createdAt.toISOString(),
        }))}
        counterparties={counterparties.map((cp) => ({ id: cp.id, name: cp.name }))}
      />
    </div>
  );
}
