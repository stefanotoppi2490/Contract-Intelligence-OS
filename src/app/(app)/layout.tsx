import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { signOut } from "@/core/services/security/auth";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/contracts", label: "Contracts" },
  { href: "/policies", label: "Policies" },
  { href: "/exceptions", label: "Exceptions" },
  { href: "/ledger", label: "Ledger" },
  { href: "/settings/members", label: "Settings (Members)" },
];

/**
 * Protected app layout: requires auth + at least one membership + selected workspace.
 * Redirects only; never renders setup pages (onboarding/select-workspace live under (setup)).
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
    <div className="min-h-screen flex flex-col">
      <header className="border-b flex items-center justify-between px-4 py-3">
        <nav className="flex gap-4 items-center">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {session.email} · Workspace selected
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
