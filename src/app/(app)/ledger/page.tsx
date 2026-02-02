import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import { LedgerClient } from "./LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Ledger</h1>
        <p className="text-muted-foreground">
          Audit trail of contract uploads, text extraction, analysis runs, exceptions, and policy changes.
        </p>
      </div>
      <LedgerClient />
    </div>
  );
}
