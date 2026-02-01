import { redirect } from "next/navigation";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { CounterpartiesClient } from "./CounterpartiesClient";

export default async function CounterpartiesPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const counterparties = await counterpartyRepo.findManyCounterpartiesByWorkspace(workspaceId);
  const canMutate = session.role !== "VIEWER";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Counterparties</h1>
      <CounterpartiesClient
        counterparties={counterparties.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          notes: c.notes,
        }))}
        canMutate={canMutate}
      />
    </div>
  );
}
