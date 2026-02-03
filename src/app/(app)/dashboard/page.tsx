import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import { redirect } from "next/navigation";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;

  const [policies, counterparties] = await Promise.all([
    policyRepo.findManyPoliciesByWorkspace(workspaceId, { select: { id: true, name: true } }),
    counterpartyRepo.findManyCounterpartiesByWorkspace(workspaceId, { select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-[#6e7985] hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[#131722]">Portfolio Risk Dashboard</h1>
        <p className="text-[#6e7985]">
          Workspace-level view of all contracts with latest risk posture. Filter by status, risk type, and exceptions.
        </p>
      </div>
      <DashboardClient policies={policies} counterparties={counterparties} />
    </div>
  );
}
