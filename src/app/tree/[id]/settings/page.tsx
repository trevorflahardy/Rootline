import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTreeById, getTreeMemberships } from "@/lib/actions/tree";
import { getMembersByTreeId } from "@/lib/actions/member";
import { getInvitesByTreeId } from "@/lib/actions/invite";
import { getTreeMembershipsWithActivity } from "@/lib/actions/permissions";
import { TreeSettingsForm } from "@/components/tree/tree-settings-form";
import { PermissionManager } from "@/components/permissions/permission-manager";
import { InviteManager } from "@/components/invite/invite-manager";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getTreeById(id);
  return { title: tree ? `Settings - ${tree.name}` : "Settings" };
}

export default async function TreeSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { id } = await params;
  const { invite } = await searchParams;
  const { userId } = await auth();
  const tree = await getTreeById(id);

  if (!tree) notFound();
  if (tree.owner_id !== userId) redirect(`/tree/${id}`);

  const [memberships, membershipsWithActivity, members, invites] = await Promise.all([
    getTreeMemberships(id),
    getTreeMembershipsWithActivity(id),
    getMembersByTreeId(id),
    getInvitesByTreeId(id),
  ]);

  return (
    <div className="flex-1 min-h-screen">
      <div className="glass-card glass-edge-top px-4 py-3 mx-4 mt-4 rounded-xl">
        <h1 className="font-semibold text-lg">Tree Settings</h1>
        <p className="text-sm text-muted-foreground">{tree.name}</p>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div className="glass-card glass-edge-top p-6 rounded-xl">
          <TreeSettingsForm
            tree={tree}
            memberships={memberships}
            members={members}
            currentUserId={userId ?? ""}
          />
        </div>
        <div className="glass-card glass-edge-top p-6 rounded-xl">
          <PermissionManager
            treeId={id}
            memberships={membershipsWithActivity}
            members={members}
            currentUserId={userId ?? ""}
          />
        </div>
        <div id="invites" className="glass-card glass-edge-top p-6 rounded-xl scroll-mt-24">
          <InviteManager
            treeId={id}
            invites={invites}
            members={members}
            initialCreateOpen={invite === "new"}
          />
        </div>
      </div>
    </div>
  );
}
