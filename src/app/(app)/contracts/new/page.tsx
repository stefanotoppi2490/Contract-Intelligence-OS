import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { NewContractForm } from "./NewContractForm";

export default async function NewContractPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const counterparties = await counterpartyRepo.findManyCounterpartiesByWorkspace(workspaceId);
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New contract</h1>
      </div>
      <NewContractForm counterparties={counterparties.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
