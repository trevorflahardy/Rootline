import { notFound } from "next/navigation";
import { getTreeById } from "@/lib/actions/tree";
import { getMemberById, getMembersByTreeId } from "@/lib/actions/member";
import { getRelationshipsByTreeId } from "@/lib/actions/relationship";
import { getTreePermissions, canEditMember } from "@/lib/actions/permissions";
import { getPhotosByMemberId } from "@/lib/actions/photo";
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
  const tree = await getTreeById(id);

  if (!tree) notFound();

  const [member, allMembers, relationships, permissions, photos] = await Promise.all([
    getMemberById(memberId, id),
    getMembersByTreeId(id),
    getRelationshipsByTreeId(id),
    getTreePermissions(id),
    getPhotosByMemberId(memberId, id),
  ]);

  if (!member) notFound();

  const canEdit = permissions.isOwner || (permissions.canEdit && await canEditMember(id, memberId));

  return (
    <div className="flex-1">
      <MemberProfile
        member={member}
        allMembers={allMembers}
        relationships={relationships}
        treeId={id}
        canEdit={canEdit}
        photos={photos}
        permissions={permissions}
      />
    </div>
  );
}
