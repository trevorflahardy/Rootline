import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTreeById } from "@/lib/actions/tree";
import { getMemberById, getMembersByTreeId } from "@/lib/actions/member";
import { getRelationshipsByTreeId } from "@/lib/actions/relationship";
import { MemberProfile } from "@/components/tree/member-profile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const member = await getMemberById(memberId, id);
  return {
    title: member
      ? `${member.first_name} ${member.last_name ?? ""}`
      : "Member",
  };
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const { userId } = await auth();
  const tree = await getTreeById(id);

  if (!tree) notFound();

  const [member, allMembers, relationships] = await Promise.all([
    getMemberById(memberId, id),
    getMembersByTreeId(id),
    getRelationshipsByTreeId(id),
  ]);

  if (!member) notFound();

  const canEdit = tree.owner_id === userId;

  return (
    <div className="flex-1">
      <MemberProfile
        member={member}
        allMembers={allMembers}
        relationships={relationships}
        treeId={id}
        canEdit={canEdit}
      />
    </div>
  );
}
