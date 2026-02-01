import { redirect } from "next/navigation";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { signOut } from "@/core/services/security/auth";
import { Button } from "@/components/ui/button";

/**
 * Setup layout: AUTH only. No workspace required.
 * Used for /onboarding and /select-workspace so they never run under (app) layout
 * and cannot trigger the workspace redirect loop.
 */
export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSessionWithWorkspace();
  if (!session?.userId) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b flex justify-end px-4 py-3">
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
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
