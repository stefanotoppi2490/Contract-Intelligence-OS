import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import { ContractDetailClient } from "./ContractDetailClient";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const { id } = await params;
  const contract = await contractRepo.getContractDetail(id, workspaceId);
  if (!contract) notFound();
  const payload = {
    id: contract.id,
    title: contract.title,
    status: contract.status,
    contractType: contract.contractType,
    counterpartyId: contract.counterpartyId,
    counterpartyName: contract.counterparty.name,
    startDate: contract.startDate?.toISOString() ?? null,
    endDate: contract.endDate?.toISOString() ?? null,
    versions: contract.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      documents: v.documents.map((d) => ({
        id: d.id,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        storageKey: d.storageKey,
      })),
    })),
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{contract.title}</h1>
        <p className="text-muted-foreground">
          {contract.counterparty.name} · {contract.contractType ?? "—"} · {contract.status}
        </p>
      </div>
      <ContractDetailClient
        contractId={contract.id}
        payload={payload}
        canMutate={session.role !== "VIEWER"}
      />
    </div>
  );
}
