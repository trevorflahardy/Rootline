"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate, formatLifespan } from "@/lib/utils/date";
import { deleteMember } from "@/lib/actions/member";
import { EditMemberDialog } from "./edit-member-dialog";
import type { TreeMember, Relationship } from "@/types";

interface MemberProfileProps {
  member: TreeMember;
  allMembers: TreeMember[];
  relationships: Relationship[];
  treeId: string;
  canEdit: boolean;
}

export function MemberProfile({
  member,
  allMembers,
  relationships,
  treeId,
  canEdit,
}: MemberProfileProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const spouses = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id || r.to_member_id === member.id) &&
        (r.relationship_type === "spouse" || r.relationship_type === "divorced")
    )
    .map((r) => {
      const otherId =
        r.from_member_id === member.id ? r.to_member_id : r.from_member_id;
      return { member: memberMap.get(otherId), type: r.relationship_type };
    })
    .filter((s) => s.member) as Array<{ member: TreeMember; type: string }>;

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
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.first_name}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <User className="h-10 w-10 text-primary" />
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
          {canEdit && (
            <div className="flex gap-2">
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
            </div>
          )}
        </div>

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
                  <div key={s.member.id} className="flex items-center">
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
