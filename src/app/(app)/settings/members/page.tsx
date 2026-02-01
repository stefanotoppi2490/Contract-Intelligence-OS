import { redirect } from "next/navigation";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole } from "@/core/services/security/rbac";
import { findManyMembershipsByWorkspace } from "@/core/db/repositories/membershipRepo";
import { MembersPageClient } from "./MembersPageClient";

export default async function SettingsMembersPage() {
  const session = await getServerSessionWithWorkspace();
  try {
    requireRole(session, { minRole: "ADMIN" });
  } catch {
    redirect("/contracts");
  }
  const workspaceId = session.currentWorkspaceId!;
  const memberships = await findManyMembershipsByWorkspace(workspaceId, {
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const members = memberships.map((m) => {
    const u = (m as unknown as { user: { email: string; name: string | null } }).user;
    return {
      id: m.id,
      userId: m.userId,
      email: u.email,
      name: u.name,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    };
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">Members</h1>
      <p className="text-muted-foreground">
        Manage workspace members. Only admins can invite, change roles, or remove members.
      </p>
      <MembersPageClient initialMembers={members} currentUserId={session.userId} />
    </div>
  );
}
