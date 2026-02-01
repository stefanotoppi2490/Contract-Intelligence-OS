import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { WorkspaceSelector } from "./WorkspaceSelector";

export default async function SelectWorkspacePage() {
  const session = await getServerSessionWithWorkspace();
  if (!session?.userId) {
    redirect("/signin");
  }
  const memberships = await import("@/core/db/repositories/membershipRepo").then((m) =>
    m.findManyMembershipsByUser(session.userId, { include: { workspace: true } })
  );
  if (memberships.length === 0) {
    redirect("/onboarding");
  }
  const workspaces = memberships.map((m) => {
    const w = (m as unknown as { workspace: { id: string; name: string } }).workspace;
    return { id: w.id, name: w.name, role: m.role };
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Select a workspace</h1>
      <p className="text-muted-foreground">
        Choose which workspace to use. You can switch later from the header.
      </p>
      <WorkspaceSelector
        workspaces={workspaces}
        currentWorkspaceId={session.currentWorkspaceId}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/onboarding" className="underline">
          Create a new workspace
        </Link>
      </p>
    </div>
  );
}
