import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import { ExceptionsClient } from "./ExceptionsClient";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const canDecide = ["ADMIN", "LEGAL", "RISK"].includes(session.role ?? "");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Exceptions</h1>
        <p className="text-muted-foreground">
          Request, approve, or reject exceptions for contract findings. Only REQUESTED items can be decided or withdrawn.
        </p>
      </div>
      <ExceptionsClient canDecide={canDecide} />
    </div>
  );
}
