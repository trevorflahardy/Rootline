"use client";

import { X, User, Calendar, MapPin, Edit, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatLifespan } from "@/lib/utils/date";
import type { TreeMember, Relationship } from "@/types";

interface MemberDetailPanelProps {
  member: TreeMember;
  relationships: Relationship[];
  allMembers: TreeMember[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectMember: (id: string) => void;
}

export function MemberDetailPanel({
  member,
  relationships,
  allMembers,
  canEdit,
  onClose,
  onEdit,
  onDelete,
  onSelectMember,
}: MemberDetailPanelProps) {
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  // Find parents, children, spouses
  const parents = relationships
    .filter((r) => r.to_member_id === member.id && (r.relationship_type === "parent_child" || r.relationship_type === "adopted"))
    .map((r) => memberMap.get(r.from_member_id))
    .filter(Boolean) as TreeMember[];

  const children = relationships
    .filter((r) => r.from_member_id === member.id && (r.relationship_type === "parent_child" || r.relationship_type === "adopted"))
    .map((r) => memberMap.get(r.to_member_id))
    .filter(Boolean) as TreeMember[];

  const spouses = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id || r.to_member_id === member.id) &&
        (r.relationship_type === "spouse" || r.relationship_type === "divorced")
    )
    .map((r) => {
      const otherId = r.from_member_id === member.id ? r.to_member_id : r.from_member_id;
      return { member: memberMap.get(otherId), type: r.relationship_type };
    })
    .filter((s) => s.member) as Array<{ member: TreeMember; type: string }>;

  const lifespan = formatLifespan(member.date_of_birth, member.date_of_death, member.is_deceased);

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-full max-w-sm border-l bg-background shadow-xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold">Member Details</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile */}
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.first_name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {member.first_name} {member.last_name}
            </h2>
            {member.maiden_name && (
              <p className="text-sm text-muted-foreground">n&eacute;e {member.maiden_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {member.is_deceased && <Badge variant="secondary">Deceased</Badge>}
              {member.gender && member.gender !== "unknown" && (
                <Badge variant="outline" className="capitalize">{member.gender}</Badge>
              )}
            </div>
          </div>
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
              <span>{member.birth_place}</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {member.bio && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-1">About</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{member.bio}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Relationships */}
        <div className="space-y-4">
          {parents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Parents</p>
              <div className="space-y-1">
                {parents.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectMember(p.id)}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <LinkIcon className="h-3 w-3 text-muted-foreground" />
                    {p.first_name} {p.last_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {spouses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Spouse</p>
              <div className="space-y-1">
                {spouses.map((s) => (
                  <button
                    key={s.member.id}
                    onClick={() => onSelectMember(s.member.id)}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <LinkIcon className="h-3 w-3 text-muted-foreground" />
                    {s.member.first_name} {s.member.last_name}
                    {s.type === "divorced" && <Badge variant="outline" className="text-[10px] ml-auto">Divorced</Badge>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Children</p>
              <div className="space-y-1">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectMember(c.id)}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <LinkIcon className="h-3 w-3 text-muted-foreground" />
                    {c.first_name} {c.last_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Added {formatDate(member.created_at)}</p>
          <p>Last updated {formatDate(member.updated_at)}</p>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
