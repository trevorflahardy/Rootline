import { notFound } from "next/navigation";
import { getTreeById } from "@/lib/actions/tree";
import { getMembersWithStats } from "@/lib/actions/member";
import { getTreePermissions } from "@/lib/actions/permissions";
import { MembersList } from "@/components/tree/members-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tree = await getTreeById(id);
  return { title: tree ? `Members — ${tree.name}` : "Members" };
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tree, members, permissions] = await Promise.all([
    getTreeById(id),
    getMembersWithStats(id),
    getTreePermissions(id),
  ]);

  if (!tree) notFound();

  return (
    <div className="flex-1 p-6">
      <MembersList
        treeId={id}
        members={members}
        canEdit={permissions.canEdit}
      />
    </div>
  );
}
