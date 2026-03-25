"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  Edit,
  Trash2,
  Link as LinkIcon,
  UserCheck,
  UserX,
  Unlink,
  Camera,
  FileText,
  Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate, formatLifespan } from "@/lib/utils/date";
import { deleteMember } from "@/lib/actions/member";
import {
  selfAssignToNode,
  selfUnassignFromNode,
  unlinkNodeProfile,
  type TreePermissions,
  type NodeProfileLink,
} from "@/lib/actions/permissions";
import { EditMemberDialog } from "./edit-member-dialog";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import type { Media } from "@/lib/actions/photo";
import type { TreeMember, Relationship, Document } from "@/types";

interface MemberProfileProps {
  member: TreeMember;
  allMembers: TreeMember[];
  relationships: Relationship[];
  treeId: string;
  canEdit: boolean;
  photos?: Media[];
  documents?: Document[];
  permissions?: TreePermissions;
  linkedProfile?: NodeProfileLink | null;
  currentUserId?: string;
}

export function MemberProfile({
  member,
  allMembers,
  relationships,
  treeId,
  canEdit,
  photos = [],
  documents = [],
  permissions,
  linkedProfile = null,
  currentUserId,
}: MemberProfileProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);

  const canSelfAssign = permissions && !permissions.linkedNodeId && !linkedProfile;
  const isSelfLinked = linkedProfile?.userId === currentUserId;
  const canOwnerUnlink = permissions?.isOwner && linkedProfile && !isSelfLinked;

  async function handleSelfAssign() {
    setAssigning(true);
    try {
      await selfAssignToNode(treeId, member.id);
      toast.success(`You are now linked to ${member.first_name}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnclaim() {
    setAssigning(true);
    try {
      await selfUnassignFromNode(treeId);
      toast.success("You have been unlinked from this node");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    } finally {
      setAssigning(false);
    }
  }

  async function handleOwnerUnlink() {
    if (!linkedProfile) return;
    setAssigning(true);
    try {
      await unlinkNodeProfile(treeId, linkedProfile.membershipId);
      toast.success(`Unlinked ${linkedProfile.displayName} from this node`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    } finally {
      setAssigning(false);
    }
  }

  const memberMap = new Map(allMembers.map((m) => [m.id, m]));
  const lifespan = formatLifespan(member.date_of_birth, member.date_of_death, member.is_deceased);

  const parents = relationships
    .filter(
      (r) =>
        r.to_member_id === member.id &&
        (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
    )
    .map((r) => memberMap.get(r.from_member_id))
    .filter(Boolean) as TreeMember[];

  const children = relationships
    .filter(
      (r) =>
        r.from_member_id === member.id &&
        (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
    )
    .map((r) => memberMap.get(r.to_member_id))
    .filter(Boolean) as TreeMember[];

  const spouseMap = new Map<string, { member: TreeMember; type: string; relationshipId: string }>();
  for (const rel of relationships) {
    if (rel.relationship_type !== "spouse" && rel.relationship_type !== "divorced") continue;
    if (rel.from_member_id !== member.id && rel.to_member_id !== member.id) continue;

    const otherId = rel.from_member_id === member.id ? rel.to_member_id : rel.from_member_id;
    const otherMember = memberMap.get(otherId);
    if (!otherMember) continue;

    const existing = spouseMap.get(otherId);
    if (!existing || (existing.type === "divorced" && rel.relationship_type === "spouse")) {
      spouseMap.set(otherId, {
        member: otherMember,
        type: rel.relationship_type,
        relationshipId: rel.id,
      });
    }
  }
  const spouses = Array.from(spouseMap.values());

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMember(member.id, treeId);
      toast.success(`${member.first_name} removed from the tree`);
      router.push(`/tree/${treeId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
      setDeleting(false);
    }
  }

  function RelatedMemberLink({ m }: { m: TreeMember }) {
    return (
      <Link
        href={`/tree/${treeId}/member/${m.id}`}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>
          {m.first_name} {m.last_name}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/tree/${treeId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to tree
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Profile header */}
        <div className="flex items-start gap-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {(linkedProfile?.avatarUrl ?? member.avatar_url) ? (
                <Image
                  src={(linkedProfile?.avatarUrl ?? member.avatar_url)!}
                  alt={member.first_name}
                  className="h-20 w-20 rounded-full object-cover"
                  width={80}
                  height={80}
                />
              ) : (
                <User className="h-10 w-10 text-primary" />
              )}
            </div>
            {linkedProfile && (
              <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-background" title={`Linked to ${linkedProfile.displayName}`}>
                <UserCheck className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {member.first_name} {member.last_name}
            </h1>
            {member.maiden_name && (
              <p className="text-sm text-muted-foreground">
                n&eacute;e {member.maiden_name}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {member.is_deceased && <Badge variant="secondary">Deceased</Badge>}
              {member.gender && member.gender !== "unknown" && (
                <Badge variant="outline" className="capitalize">
                  {member.gender}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Profile link card */}
        {linkedProfile ? (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <Fingerprint className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Linked to {linkedProfile.displayName}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  {isSelfLinked
                    ? "Your account is connected to this person in the tree"
                    : "This person has linked their account to this node"}
                </p>
              </div>
              {isSelfLinked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  onClick={handleUnclaim}
                  disabled={assigning}
                >
                  <UserX className="h-3.5 w-3.5 mr-1.5" />
                  {assigning ? "..." : "Unlink me"}
                </Button>
              )}
              {canOwnerUnlink && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 dark:border-red-800 text-destructive hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={handleOwnerUnlink}
                  disabled={assigning}
                >
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  {assigning ? "..." : "Remove link"}
                </Button>
              )}
            </div>
          </div>
        ) : canSelfAssign ? (
          <button
            onClick={handleSelfAssign}
            disabled={assigning}
            className="w-full group relative rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all p-4 text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {assigning ? "Linking your account..." : "This is me!"}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  Link your account to this person. Your profile picture will appear on their tree node.
                </p>
              </div>
            </div>
          </button>
        ) : null}

        {/* Quick info */}
        <div className="space-y-2">
          {lifespan && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{lifespan}</span>
            </div>
          )}
          {member.birth_place && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>Born in {member.birth_place}</span>
            </div>
          )}
          {member.death_place && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>Died in {member.death_place}</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {member.bio && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {member.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Relationships */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Family</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Parents
                </p>
                {parents.map((p) => (
                  <RelatedMemberLink key={p.id} m={p} />
                ))}
              </div>
            )}
            {spouses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Spouse
                </p>
                {spouses.map((s) => (
                  <div key={s.relationshipId} className="flex items-center">
                    <RelatedMemberLink m={s.member} />
                    {s.type === "divorced" && (
                      <Badge variant="outline" className="text-[10px] ml-1">
                        Divorced
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            {children.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Children
                </p>
                {children.map((c) => (
                  <RelatedMemberLink key={c.id} m={c} />
                ))}
              </div>
            )}
            {parents.length === 0 && spouses.length === 0 && children.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No family relationships recorded yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Photos</CardTitle>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowPhotoUpload(true)}>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                Upload
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <PhotoGallery photos={photos} treeId={treeId} canEdit={canEdit} />
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Documents</CardTitle>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowDocUpload(true)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Upload
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <DocumentList
              documents={documents}
              canEdit={canEdit}
              currentUserId={currentUserId ?? ""}
              treeId={treeId}
              onRefresh={() => router.refresh()}
            />
          </CardContent>
        </Card>

        {/* Photo upload dialog */}
        <PhotoUpload
          open={showPhotoUpload}
          onOpenChange={setShowPhotoUpload}
          treeId={treeId}
          memberId={member.id}
          onUploaded={() => router.refresh()}
        />

        {/* Document upload dialog */}
        <DocumentUpload
          open={showDocUpload}
          onOpenChange={setShowDocUpload}
          treeId={treeId}
          memberId={member.id}
          onUploadComplete={() => router.refresh()}
        />

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Added {formatDate(member.created_at)}</p>
          <p>Last updated {formatDate(member.updated_at)}</p>
        </div>
      </div>

      {/* Edit dialog */}
      <EditMemberDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        member={member}
        treeId={treeId}
        onUpdated={() => router.refresh()}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete member?"
        description={`This will permanently remove ${member.first_name} ${member.last_name ?? ""} and all their relationships from the tree.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
