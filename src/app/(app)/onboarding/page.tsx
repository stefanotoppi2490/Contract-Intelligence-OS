import { redirect } from "next/navigation";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { CreateWorkspaceForm } from "./CreateWorkspaceForm";

export default async function OnboardingPage() {
  const session = await getServerSessionWithWorkspace();
  if (!session?.userId) {
    redirect("/signin");
  }
  const memberships = await import("@/core/db/repositories/membershipRepo").then((m) =>
    m.findManyMembershipsByUser(session.userId, { include: { workspace: true } })
  );
  if (memberships.length > 0) {
    redirect("/select-workspace");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Create your first workspace</h1>
      <p className="text-muted-foreground">
        Give your workspace a name. You will be an admin and can invite members later.
      </p>
      <CreateWorkspaceForm />
    </div>
  );
}
