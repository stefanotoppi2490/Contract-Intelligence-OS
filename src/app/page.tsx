import { redirect } from "next/navigation";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";

export default async function HomePage() {
  const session = await getServerSessionWithWorkspace();
  if (!session?.userId) {
    redirect("/signin");
  }
  if (session.currentWorkspaceId) {
    redirect("/contracts");
  }
  redirect("/select-workspace");
}
