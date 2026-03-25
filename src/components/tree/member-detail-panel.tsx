"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  User,
  Edit,
  Trash2,
  Check,
  XIcon,
  ExternalLink,
  UserCheck,
  UserX,
  Unlink,
  Fingerprint,
  Shield,
  FileText,
  Upload,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils/date";
import { updateMember } from "@/lib/actions/member";
import { getDocumentsByMember, uploadDocument } from "@/lib/actions/document";
import { getPhotosByMemberId, type Media } from "@/lib/actions/photo";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotoUpload } from "@/components/photos/photo-upload";
import {
  selfAssignToNode,
  selfUnassignFromNode,
  unlinkNodeProfile,
  getNodeMembership,
  updateMemberRole,
  type TreePermissions,
  type NodeProfileLink,
  type NodeMembership,
} from "@/lib/actions/permissions";
import type { TreeMember, Relationship, Document } from "@/types";

interface MemberDetailPanelProps {
  member: TreeMember;
  relationships: Relationship[];
  allMembers: TreeMember[];
  canEditMember: (memberId: string) => Promise<boolean>;
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

// Inline editable select field component
function InlineSelectField({
  label,
  value,
  field,
  options,
  canEdit,
  onSave,
}: {
  label: string;
  value: string | null;
  field: string;
  options: { value: string; label: string }[];
  canEdit: boolean;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newValue: string) => {
    setSaving(true);
    try {
      await onSave(field, newValue);
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const displayLabel = options.find((o) => o.value === value)?.label ?? "—";
  const isEmpty = !value;

  if (editing) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1">
          <Select defaultValue={value ?? undefined} onValueChange={handleChange} disabled={saving}>
            <SelectTrigger className="h-7 text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setEditing(false)}>
            <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={`text-sm ${isEmpty ? "text-muted-foreground/50 italic" : ""} ${canEdit ? "cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors" : ""}`}
        onClick={canEdit ? () => setEditing(true) : undefined}
        title={canEdit ? "Click to edit" : undefined}
      >
        {displayLabel}
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
      className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-sm glass-card glass-light hover:bg-foreground/10 dark:hover:bg-foreground/10 transition-colors text-left group"
    >
      <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary overflow-hidden">
        {member.avatar_url ? (
          <Image src={member.avatar_url} alt={member.first_name} className="h-8 w-8 rounded-full object-cover" width={32} height={32} />
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

function DocumentDropZone({
  treeId,
  memberId,
  onUploaded,
}: {
  treeId: string;
  memberId: string;
  onUploaded: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.value = "";
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("treeId", treeId);
      formData.set("memberId", memberId);
      formData.set("file", file);
      formData.set("document_type", "other");
      await uploadDocument(formData);
      toast.success(`Uploaded ${file.name}`);
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <label
      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-3 cursor-pointer transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-muted-foreground/40"
      } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground text-center">
        {uploading ? "Uploading..." : "Drop file or click to upload"}
      </span>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx"
        onChange={handleFileSelect}
        disabled={uploading}
      />
    </label>
  );
}

export function MemberDetailPanel({
  member,
  relationships,
  allMembers,
  canEditMember,
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
  const [memberCanEdit, setMemberCanEdit] = useState(false);
  const [editCheckLoading, setEditCheckLoading] = useState(true);
  const [nodeMembership, setNodeMembership] = useState<NodeMembership | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const memberMap = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);

  // Check per-member edit permission
  useEffect(() => {
    setEditCheckLoading(true);
    setMemberCanEdit(false);
    canEditMember(member.id).then((result) => {
      setMemberCanEdit(result);
      setEditCheckLoading(false);
    }).catch(() => {
      setMemberCanEdit(false);
      setEditCheckLoading(false);
    });
  }, [member.id, canEditMember]);

  // Fetch node membership info for permissions section
  useEffect(() => {
    if (!permissions?.canEdit) {
      setNodeMembership(null);
      return;
    }
    getNodeMembership(treeId, member.id).then(setNodeMembership).catch(() => setNodeMembership(null));
  }, [treeId, member.id, permissions?.canEdit]);

  // Fetch documents and photos for this member
  useEffect(() => {
    getDocumentsByMember(treeId, member.id)
      .then(setDocuments)
      .catch(() => setDocuments([]));
    getPhotosByMemberId(member.id, treeId)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [treeId, member.id]);

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

  // Find parents, children, spouses, and extended relationships
  const parents = relationships
    .filter((r) => r.to_member_id === member.id && (r.relationship_type === "parent_child" || r.relationship_type === "adopted"))
    .map((r) => ({ member: memberMap.get(r.from_member_id), type: r.relationship_type }))
    .filter((p) => p.member) as Array<{ member: TreeMember; type: string }>;

  const children = relationships
    .filter((r) => r.from_member_id === member.id && (r.relationship_type === "parent_child" || r.relationship_type === "adopted"))
    .map((r) => ({ member: memberMap.get(r.to_member_id), type: r.relationship_type }))
    .filter((c) => c.member) as Array<{ member: TreeMember; type: string }>;

  const spouseMap = new Map<string, { member: TreeMember; type: string; relationshipId: string }>();
  for (const rel of relationships) {
    if (rel.relationship_type !== "spouse" && rel.relationship_type !== "divorced") continue;
    if (rel.from_member_id !== member.id && rel.to_member_id !== member.id) continue;

    const otherId = rel.from_member_id === member.id ? rel.to_member_id : rel.from_member_id;
    const otherMember = memberMap.get(otherId);
    if (!otherMember) continue;

    const existing = spouseMap.get(otherId);
    // Prefer active spouse label when both spouse and divorced records exist.
    if (!existing || (existing.type === "divorced" && rel.relationship_type === "spouse")) {
      spouseMap.set(otherId, {
        member: otherMember,
        type: rel.relationship_type,
        relationshipId: rel.id,
      });
    }
  }
  const spouses = Array.from(spouseMap.values());

  const siblings = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id || r.to_member_id === member.id) &&
        r.relationship_type === "sibling"
    )
    .map((r) => {
      const otherId = r.from_member_id === member.id ? r.to_member_id : r.from_member_id;
      return { member: memberMap.get(otherId), type: r.relationship_type };
    })
    .filter((s) => s.member) as Array<{ member: TreeMember; type: string }>;

  const stepParents = relationships
    .filter(
      (r) =>
        (r.to_member_id === member.id && r.relationship_type === "step_parent") ||
        (r.from_member_id === member.id && r.relationship_type === "step_child")
    )
    .map((r) => {
      const parentId = r.relationship_type === "step_parent" ? r.from_member_id : r.to_member_id;
      return { member: memberMap.get(parentId), type: r.relationship_type };
    })
    .filter((s) => s.member) as Array<{ member: TreeMember; type: string }>;

  const stepChildren = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id && r.relationship_type === "step_parent") ||
        (r.to_member_id === member.id && r.relationship_type === "step_child")
    )
    .map((r) => {
      const childId = r.relationship_type === "step_parent" ? r.to_member_id : r.from_member_id;
      return { member: memberMap.get(childId), type: r.relationship_type };
    })
    .filter((s) => s.member) as Array<{ member: TreeMember; type: string }>;

  const inLaws = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id || r.to_member_id === member.id) &&
        r.relationship_type === "in_law"
    )
    .map((r) => {
      const otherId = r.from_member_id === member.id ? r.to_member_id : r.from_member_id;
      return { member: memberMap.get(otherId), type: r.relationship_type };
    })
    .filter((s) => s.member) as Array<{ member: TreeMember; type: string }>;

  const guardians = relationships
    .filter((r) => r.to_member_id === member.id && r.relationship_type === "guardian")
    .map((r) => ({ member: memberMap.get(r.from_member_id), type: r.relationship_type }))
    .filter((g) => g.member) as Array<{ member: TreeMember; type: string }>;

  const wards = relationships
    .filter((r) => r.from_member_id === member.id && r.relationship_type === "guardian")
    .map((r) => ({ member: memberMap.get(r.to_member_id), type: r.relationship_type }))
    .filter((w) => w.member) as Array<{ member: TreeMember; type: string }>;

  const handleInlineSave = useCallback(
    async (field: string, value: string) => {
      try {
        await updateMember(member.id, member.tree_id, { [field]: value });
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/branch|permission|cannot edit/i.test(msg)) {
          setMemberCanEdit(false);
        }
        throw err;
      }
    },
    [member.id, member.tree_id, router]
  );

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-full max-w-sm glass-card glass-heavy glass-edge-top glass-edge-left overflow-y-auto" style={{ backdropFilter: 'blur(72px)', WebkitBackdropFilter: 'blur(72px)' }}>
      {/* Header */}
      <div className="sticky top-0 border-b border-[var(--glass-border-subtle)] px-4 py-3 flex items-center justify-between z-10" style={{ background: 'var(--glass-bg-heavy)', backdropFilter: 'blur(72px)', WebkitBackdropFilter: 'blur(72px)' }}>
        <h3 className="font-semibold">Member Details</h3>
        <div className="flex items-center gap-1">
          {memberCanEdit && !editCheckLoading && (
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
                <Image src={(linkedProfile?.avatarUrl ?? member.avatar_url)!} alt={member.first_name} className="h-16 w-16 rounded-full object-cover" width={64} height={64} />
              ) : (
                <User className="h-8 w-8 text-primary" />
              )}
            </div>
            {linkedProfile && (
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-background" title={`Linked to ${linkedProfile.displayName}`}>
                <UserCheck className="h-3 w-3 text-foreground" />
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
                <Badge variant="outline" className="capitalize">
                  {member.gender === "other" ? "Custom" : member.gender}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Profile link */}
        {linkedProfile ? (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <Fingerprint className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100 truncate">
                  Linked to {linkedProfile.displayName}
                </p>
                <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                  {isSelfLinked ? "Your account" : "Account linked"}
                </p>
              </div>
              {isSelfLinked && (
                <Button variant="ghost" size="sm" className="h-7 text-xs border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300" onClick={handleUnclaim} disabled={claimLoading}>
                  <UserX className="h-3 w-3 mr-1" />
                  {claimLoading ? "..." : "Unlink"}
                </Button>
              )}
              {canOwnerUnlink && (
                <Button variant="ghost" size="sm" className="h-7 text-xs border border-red-200 dark:border-red-800 text-destructive" onClick={handleOwnerUnlink} disabled={claimLoading}>
                  <Unlink className="h-3 w-3 mr-1" />
                  {claimLoading ? "..." : "Remove"}
                </Button>
              )}
            </div>
          </div>
        ) : canClaim ? (
          <button
            onClick={handleClaim}
            disabled={claimLoading}
            className="w-full group rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all px-3 py-2.5 text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Fingerprint className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {claimLoading ? "Linking..." : "This is me! Link my account"}
                </p>
                <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                  Link your account to show your profile picture and let relatives know it&apos;s you
                </p>
              </div>
            </div>
          </button>
        ) : null}

        {/* Permissions Section - visible to editors and owners */}
        {permissions?.canEdit && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Permissions
              </p>

              {nodeMembership ? (
                <div className="rounded-lg border px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        {nodeMembership.avatarUrl ? (
                          <Image src={nodeMembership.avatarUrl} alt={nodeMembership.displayName} className="h-6 w-6 rounded-full object-cover" width={24} height={24} />
                        ) : (
                          <User className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{nodeMembership.displayName}</span>
                    </div>
                    {permissions.isOwner ? (
                      <select
                        className="text-xs border rounded px-2 py-1 bg-background"
                        value={nodeMembership.role}
                        disabled={roleUpdating || nodeMembership.role === "owner"}
                        onChange={async (e) => {
                          const newRole = e.target.value as "editor" | "viewer";
                          setRoleUpdating(true);
                          try {
                            await updateMemberRole(treeId, nodeMembership.id, newRole);
                            setNodeMembership((prev) => prev ? { ...prev, role: newRole } : prev);
                            toast.success(`Role updated to ${newRole}`);
                            router.refresh();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to update role");
                          } finally {
                            setRoleUpdating(false);
                          }
                        }}
                      >
                        {nodeMembership.role === "owner" && (
                          <option value="owner">Owner</option>
                        )}
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <Badge variant="outline" className="text-xs capitalize">{nodeMembership.role}</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No user linked to this member</p>
              )}
            </div>
          </>
        )}

        <Separator />

        {/* All fields — click to edit for admins */}
        <div className="space-y-3">
          <InlineField label="First name" value={member.first_name} field="first_name" canEdit={memberCanEdit} onSave={handleInlineSave} />
          <InlineField label="Last name" value={member.last_name} field="last_name" canEdit={memberCanEdit} onSave={handleInlineSave} />
          <InlineField label="Maiden name" value={member.maiden_name} field="maiden_name" canEdit={memberCanEdit} onSave={handleInlineSave} />
          <InlineField label="Date of birth" value={member.date_of_birth} field="date_of_birth" type="date" canEdit={memberCanEdit} onSave={handleInlineSave} />
          <InlineField label="Birth place" value={member.birth_place} field="birth_place" canEdit={memberCanEdit} onSave={handleInlineSave} />
          {(member.is_deceased || member.date_of_death) && (
            <>
              <InlineField label="Date of death" value={member.date_of_death} field="date_of_death" type="date" canEdit={memberCanEdit} onSave={handleInlineSave} />
              <InlineField label="Death place" value={member.death_place} field="death_place" canEdit={memberCanEdit} onSave={handleInlineSave} />
            </>
          )}
          <InlineField label="Bio" value={member.bio} field="bio" type="textarea" canEdit={memberCanEdit} onSave={handleInlineSave} />
          <InlineSelectField
            label="Gender"
            value={member.gender ?? null}
            field="gender"
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Custom" },
              { value: "unknown", label: "Unknown" },
            ]}
            canEdit={memberCanEdit}
            onSave={handleInlineSave}
          />
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
                    key={s.relationshipId}
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

          {siblings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Siblings</p>
              <div className="space-y-0.5">
                {siblings.map((s) => (
                  <RelatedMemberCard
                    key={s.member.id}
                    member={s.member}
                    onSelect={() => onSelectMember(s.member.id)}
                    onHover={(h) => onHoverMember?.(h ? s.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {stepParents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Step-Parents</p>
              <div className="space-y-0.5">
                {stepParents.map((s) => (
                  <RelatedMemberCard
                    key={s.member.id}
                    member={s.member}
                    onSelect={() => onSelectMember(s.member.id)}
                    onHover={(h) => onHoverMember?.(h ? s.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {stepChildren.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Step-Children</p>
              <div className="space-y-0.5">
                {stepChildren.map((s) => (
                  <RelatedMemberCard
                    key={s.member.id}
                    member={s.member}
                    onSelect={() => onSelectMember(s.member.id)}
                    onHover={(h) => onHoverMember?.(h ? s.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {inLaws.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">In-Laws</p>
              <div className="space-y-0.5">
                {inLaws.map((il) => (
                  <RelatedMemberCard
                    key={il.member.id}
                    member={il.member}
                    onSelect={() => onSelectMember(il.member.id)}
                    onHover={(h) => onHoverMember?.(h ? il.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {guardians.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Guardians</p>
              <div className="space-y-0.5">
                {guardians.map((g) => (
                  <RelatedMemberCard
                    key={g.member.id}
                    member={g.member}
                    onSelect={() => onSelectMember(g.member.id)}
                    onHover={(h) => onHoverMember?.(h ? g.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {wards.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Wards</p>
              <div className="space-y-0.5">
                {wards.map((w) => (
                  <RelatedMemberCard
                    key={w.member.id}
                    member={w.member}
                    onSelect={() => onSelectMember(w.member.id)}
                    onHover={(h) => onHoverMember?.(h ? w.member.id : null)}
                  />
                ))}
              </div>
            </div>
          )}

          {parents.length === 0 && spouses.length === 0 && children.length === 0 &&
           siblings.length === 0 && stepParents.length === 0 && stepChildren.length === 0 &&
           inLaws.length === 0 && guardians.length === 0 && wards.length === 0 && (
            <p className="text-sm text-muted-foreground">No family relationships recorded yet.</p>
          )}
        </div>

        <Separator />

        {/* Photos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="h-3 w-3" />
              Photos
              {photos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">
                  {photos.length}
                </Badge>
              )}
            </p>
            {memberCanEdit && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPhotoUploadOpen(true)}>
                <Upload className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
          <PhotoGallery photos={photos} treeId={treeId} canEdit={memberCanEdit} />
          <PhotoUpload
            open={photoUploadOpen}
            onOpenChange={setPhotoUploadOpen}
            treeId={treeId}
            memberId={member.id}
            onUploaded={() => {
              getPhotosByMemberId(member.id, treeId).then(setPhotos).catch(() => {});
              router.refresh();
            }}
          />
        </div>

        <Separator />

        {/* Documents */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Documents
              {documents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">
                  {documents.length}
                </Badge>
              )}
            </p>
          </div>
          {documents.length > 0 ? (
            <div className="space-y-1">
              {documents.slice(0, 3).map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm rounded px-2 py-1.5 hover:bg-accent/30 transition-colors">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate flex-1">{doc.file_name}</span>
                  <DocumentTypeBadge documentType={doc.document_type} />
                </div>
              ))}
              {documents.length > 3 && (
                <p className="text-xs text-muted-foreground px-2">
                  +{documents.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No documents attached</p>
          )}

          {/* Drag & drop upload zone */}
          {memberCanEdit && (
            <DocumentDropZone
              treeId={treeId}
              memberId={member.id}
              onUploaded={() => {
                getDocumentsByMember(treeId, member.id).then(setDocuments).catch(() => {});
                router.refresh();
              }}
            />
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
