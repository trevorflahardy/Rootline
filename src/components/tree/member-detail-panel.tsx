"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  User,
  Calendar,
  MapPin,
  Edit,
  Trash2,
  Check,
  XIcon,
  ExternalLink,
  UserCheck,
  UserX,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatLifespan } from "@/lib/utils/date";
import { updateMember } from "@/lib/actions/member";
import {
  selfAssignToNode,
  selfUnassignFromNode,
  unlinkNodeProfile,
  type TreePermissions,
  type NodeProfileLink,
} from "@/lib/actions/permissions";
import type { TreeMember, Relationship } from "@/types";

interface MemberDetailPanelProps {
  member: TreeMember;
  relationships: Relationship[];
  allMembers: TreeMember[];
  canEdit: boolean;
  treeId: string;
  currentUserId: string;
  permissions: TreePermissions | null;
  linkedProfile: NodeProfileLink | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectMember: (id: string) => void;
  onHoverMember?: (id: string | null) => void;
}

// Inline editable field component
function InlineField({
  label,
  value,
  field,
  type = "text",
  canEdit,
  onSave,
}: {
  label: string;
  value: string | null;
  field: string;
  type?: "text" | "date" | "textarea";
  canEdit: boolean;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(field, editValue);
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1">
          {type === "textarea" ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-sm min-h-[60px]"
              autoFocus
            />
          ) : (
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleSave} disabled={saving}>
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleCancel}>
            <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  const displayValue = value || "—";
  const isEmpty = !value;

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={`text-sm ${isEmpty ? "text-muted-foreground/50 italic" : ""} ${canEdit ? "cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors" : ""}`}
        onClick={canEdit ? () => { setEditValue(value ?? ""); setEditing(true); } : undefined}
        title={canEdit ? "Click to edit" : undefined}
      >
        {displayValue}
      </p>
    </div>
  );
}

// Mini profile card for related members
function RelatedMemberCard({
  member,
  badge,
  onSelect,
  onHover,
}: {
  member: TreeMember;
  badge?: string;
  onSelect: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-sm hover:bg-accent transition-colors text-left group"
    >
      <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary overflow-hidden">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.first_name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {member.first_name} {member.last_name}
        </p>
        {member.date_of_birth && (
          <p className="text-[10px] text-muted-foreground">
            {member.date_of_birth.substring(0, 4)}
            {member.is_deceased && member.date_of_death ? ` – ${member.date_of_death.substring(0, 4)}` : ""}
          </p>
        )}
      </div>
      {badge && (
        <Badge variant="outline" className="text-[10px] ml-auto flex-shrink-0">{badge}</Badge>
      )}
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}

export function MemberDetailPanel({
  member,
  relationships,
  allMembers,
  canEdit,
  treeId,
  currentUserId,
  permissions,
  linkedProfile,
  onClose,
  onEdit,
  onDelete,
  onSelectMember,
  onHoverMember,
}: MemberDetailPanelProps) {
  const router = useRouter();
  const [claimLoading, setClaimLoading] = useState(false);
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  // Can user claim this node? Must have a membership, not already linked, and node not claimed
  const canClaim = permissions && !permissions.linkedNodeId && !linkedProfile;
  // Is the current user the one linked to this node?
  const isSelfLinked = linkedProfile?.userId === currentUserId;
  // Can owner unlink someone else?
  const canOwnerUnlink = permissions?.isOwner && linkedProfile && !isSelfLinked;

  async function handleClaim() {
    setClaimLoading(true);
    try {
      await selfAssignToNode(treeId, member.id);
      toast.success(`You are now linked to ${member.first_name}!`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to claim");
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleUnclaim() {
    setClaimLoading(true);
    try {
      await selfUnassignFromNode(treeId);
      toast.success("You have been unlinked from this node");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleOwnerUnlink() {
    if (!linkedProfile) return;
    setClaimLoading(true);
    try {
      await unlinkNodeProfile(treeId, linkedProfile.membershipId);
      toast.success(`Unlinked ${linkedProfile.displayName} from this node`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    } finally {
      setClaimLoading(false);
    }
  }

  // Find parents, children, spouses
  const parents = relationships
    .filter((r) => r.to_member_id === member.id && (r.relationship_type === "parent_child" || r.relationship_type === "adopted"))
    .map((r) => ({ member: memberMap.get(r.from_member_id), type: r.relationship_type }))
    .filter((p) => p.member) as Array<{ member: TreeMember; type: string }>;

  const children = relationships
    .filter((r) => r.from_member_id === member.id && (r.relationship_type === "parent_child" || r.relationship_type === "adopted"))
    .map((r) => ({ member: memberMap.get(r.to_member_id), type: r.relationship_type }))
    .filter((c) => c.member) as Array<{ member: TreeMember; type: string }>;

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

  const handleInlineSave = useCallback(
    async (field: string, value: string) => {
      await updateMember(member.id, member.tree_id, { [field]: value });
      router.refresh();
    },
    [member.id, member.tree_id, router]
  );

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-full max-w-sm border-l bg-background shadow-xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between z-10">
        <h3 className="font-semibold">Member Details</h3>
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Full edit">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Profile */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {(linkedProfile?.avatarUrl ?? member.avatar_url) ? (
                <img src={(linkedProfile?.avatarUrl ?? member.avatar_url)!} alt={member.first_name} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-primary" />
              )}
            </div>
            {linkedProfile && (
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-background" title={`Linked to ${linkedProfile.displayName}`}>
                <UserCheck className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">
              {member.first_name} {member.last_name}
            </h2>
            {member.maiden_name && (
              <p className="text-sm text-muted-foreground">n&eacute;e {member.maiden_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {member.is_deceased && <Badge variant="secondary">Deceased</Badge>}
              {member.gender && member.gender !== "unknown" && (
                <Badge variant="outline" className="capitalize">{member.gender}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Profile link actions */}
        {linkedProfile ? (
          <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
            <UserCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-700 dark:text-blue-300 flex-1 truncate">
              Linked to {linkedProfile.displayName}
            </span>
            {isSelfLinked && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleUnclaim} disabled={claimLoading}>
                <UserX className="h-3.5 w-3.5 mr-1" />
                {claimLoading ? "..." : "Unassign"}
              </Button>
            )}
            {canOwnerUnlink && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={handleOwnerUnlink} disabled={claimLoading}>
                <Unlink className="h-3.5 w-3.5 mr-1" />
                {claimLoading ? "..." : "Remove"}
              </Button>
            )}
          </div>
        ) : canClaim ? (
          <Button variant="outline" size="sm" className="w-full" onClick={handleClaim} disabled={claimLoading}>
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            {claimLoading ? "Linking..." : "This is me!"}
          </Button>
        ) : null}

        <Separator />

        {/* All fields — click to edit for admins */}
        <div className="space-y-3">
          <InlineField label="First name" value={member.first_name} field="first_name" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="Last name" value={member.last_name} field="last_name" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="Maiden name" value={member.maiden_name} field="maiden_name" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="Date of birth" value={member.date_of_birth} field="date_of_birth" type="date" canEdit={canEdit} onSave={handleInlineSave} />
          <InlineField label="Birth place" value={member.birth_place} field="birth_place" canEdit={canEdit} onSave={handleInlineSave} />
          {(member.is_deceased || member.date_of_death) && (
            <>
              <InlineField label="Date of death" value={member.date_of_death} field="date_of_death" type="date" canEdit={canEdit} onSave={handleInlineSave} />
              <InlineField label="Death place" value={member.death_place} field="death_place" canEdit={canEdit} onSave={handleInlineSave} />
            </>
          )}
          <InlineField label="Bio" value={member.bio} field="bio" type="textarea" canEdit={canEdit} onSave={handleInlineSave} />
        </div>

        <Separator />

        {/* Relationships with rich mini profile cards */}
        <div className="space-y-4">
          {parents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Parents</p>
              <div className="space-y-0.5">
                {parents.map((p) => (
                  <RelatedMemberCard
                    key={p.member.id}
                    member={p.member}
                    badge={p.type === "adopted" ? "Adopted" : undefined}
                    onSelect={() => onSelectMember(p.member.id)}
                    onHover={(h) => onHoverMember?.(h ? p.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {spouses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Spouse</p>
              <div className="space-y-0.5">
                {spouses.map((s) => (
                  <RelatedMemberCard
                    key={s.member.id}
                    member={s.member}
                    badge={s.type === "divorced" ? "Divorced" : undefined}
                    onSelect={() => onSelectMember(s.member.id)}
                    onHover={(h) => onHoverMember?.(h ? s.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Children</p>
              <div className="space-y-0.5">
                {children.map((c) => (
                  <RelatedMemberCard
                    key={c.member.id}
                    member={c.member}
                    badge={c.type === "adopted" ? "Adopted" : undefined}
                    onSelect={() => onSelectMember(c.member.id)}
                    onHover={(h) => onHoverMember?.(h ? c.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {parents.length === 0 && spouses.length === 0 && children.length === 0 && (
            <p className="text-sm text-muted-foreground">No family relationships recorded yet.</p>
          )}
        </div>

        <Separator />

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Added {formatDate(member.created_at)}</p>
          <p>Last updated {formatDate(member.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
