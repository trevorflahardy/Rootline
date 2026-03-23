import { notFound } from "next/navigation";
import { getTreeById } from "@/lib/actions/tree";
import { getMemberById, getMembersByTreeId } from "@/lib/actions/member";
import { getRelationshipsByTreeId } from "@/lib/actions/relationship";
import { auth } from "@clerk/nextjs/server";
import { getTreePermissions, canEditMember, getNodeProfileMap } from "@/lib/actions/permissions";
import { getPhotosByMemberId } from "@/lib/actions/photo";
import { getDocumentsByMember } from "@/lib/actions/document";
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

  const { userId } = await auth();
  const [member, allMembers, relationships, permissions, photos, documents, nodeProfileMap] = await Promise.all([
    getMemberById(memberId, id),
    getMembersByTreeId(id),
    getRelationshipsByTreeId(id),
    getTreePermissions(id),
    getPhotosByMemberId(memberId, id),
    getDocumentsByMember(id, memberId),
    getNodeProfileMap(id),
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
        documents={documents}
        permissions={permissions}
        linkedProfile={nodeProfileMap[memberId] ?? null}
        currentUserId={userId ?? ""}
      />
    </div>
  );
}
