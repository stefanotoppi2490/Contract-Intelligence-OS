import { redirect } from "next/navigation";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { AppShellClient } from "@/components/app-shell/AppShellClient";

/**
 * Protected app layout: requires auth + at least one membership + selected workspace.
 * Redirects only; never renders setup pages (onboarding/select-workspace live under (setup)).
 * Shell: Super Admin–style sidebar + header + body (Tailwind only).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  if (!session.currentWorkspaceId || !session.role) {
    redirect("/select-workspace");
  }

  return (
    <AppShellClient
      session={{
        email: session.email ?? null,
        user: session.user
          ? { name: session.user.name ?? null, image: session.user.image ?? null }
          : undefined,
      }}
    >
      {children}
    </AppShellClient>
  );
}
