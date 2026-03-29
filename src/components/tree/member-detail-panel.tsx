"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, User, Edit, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils/date";
import { updateMember } from "@/lib/actions/member";
import { getDocumentsByMember } from "@/lib/actions/document";
import { getPhotosByMemberId, type Media } from "@/lib/actions/photo";
import type { TreePermissions, NodeProfileLink } from "@/lib/actions/permissions";
import type { TreeMember, Relationship, Document } from "@/types";
import { InlineField, InlineSelectField, type FieldLockInfo } from "./member-inline-fields";
import { MemberRelationshipsList } from "./member-relationships-list";
import { MemberPhotoSection } from "./member-photo-section";
import { MemberPermissionsSection } from "./member-permissions-section";
import { useMemberRelationships } from "./hooks/use-member-relationships";

interface MemberDetailPanelProps {
  member: TreeMember;
  relationships: Relationship[];
  allMembers: TreeMember[];
  canEditMember: (memberId: string) => Promise<boolean>;
  treeId: string;
  currentUserId: string;
  permissions: TreePermissions | null;
  linkedProfile: NodeProfileLink | null;
  collaboratorLocks?: Record<string, FieldLockInfo>;
  onFieldEditStart?: (memberId: string, field: string) => void;
  onFieldEditEnd?: (memberId: string, field: string) => void;
  onMemberFieldSaved?: (member: TreeMember) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectMember: (id: string) => void;
  onHoverMember?: (id: string | null) => void;
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
  collaboratorLocks = {},
  onFieldEditStart,
  onFieldEditEnd,
  onMemberFieldSaved,
  onClose,
  onEdit,
  onDelete,
  onSelectMember,
  onHoverMember,
}: MemberDetailPanelProps) {
  const router = useRouter();
  const [memberCanEdit, setMemberCanEdit] = useState(false);
  const [editCheckLoading, setEditCheckLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [photos, setPhotos] = useState<Media[]>([]);

  // Check per-member edit permission (async fetch, so setState in callback is valid)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEditCheckLoading(true);
    setMemberCanEdit(false);
    canEditMember(member.id)
      .then((result) => {
        setMemberCanEdit(result);
        setEditCheckLoading(false);
      })
      .catch(() => {
        setMemberCanEdit(false);
        setEditCheckLoading(false);
      });
  }, [member.id, canEditMember]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch documents and photos for this member
  useEffect(() => {
    getDocumentsByMember(treeId, member.id)
      .then(setDocuments)
      .catch(() => setDocuments([]));
    getPhotosByMemberId(member.id, treeId)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [treeId, member.id]);

  const {
    parents,
    children,
    spouses,
    siblings,
    stepParents,
    stepChildren,
    inLaws,
    guardians,
    wards,
    relationshipMutationLoading,
    handleDeleteRelationship,
    handleChangeRelationshipType,
  } = useMemberRelationships({ member, relationships, allMembers, treeId });

  const handleInlineSave = useCallback(
    async (field: string, value: string) => {
      try {
        const updated = await updateMember(member.id, member.tree_id, { [field]: value });
        onMemberFieldSaved?.(updated);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/branch|permission|cannot edit/i.test(msg)) {
          setMemberCanEdit(false);
        }
        throw err;
      }
    },
    [member.id, member.tree_id, onMemberFieldSaved, router]
  );

  const fieldProps = {
    memberId: member.id,
    currentUserId,
    canEdit: memberCanEdit,
    onEditStart: onFieldEditStart,
    onEditEnd: onFieldEditEnd,
    onSave: handleInlineSave,
  };

  return (
    <div
      className="glass-card glass-heavy glass-edge-top glass-edge-left absolute top-0 right-0 z-20 h-full w-full max-w-sm overflow-y-auto"
      style={{ backdropFilter: "blur(72px)", WebkitBackdropFilter: "blur(72px)" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--glass-border-subtle)] px-4 py-3"
        style={{
          background: "var(--glass-bg-heavy)",
          backdropFilter: "blur(72px)",
          WebkitBackdropFilter: "blur(72px)",
        }}
      >
        <h3 className="font-semibold">Member Details</h3>
        <div className="flex items-center gap-1">
          {memberCanEdit && !editCheckLoading && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                title="Full edit"
                aria-label="Edit member"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8"
                onClick={onDelete}
                title="Delete"
                aria-label="Delete member"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Profile */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="bg-primary/10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full">
              {(linkedProfile?.avatarUrl ?? member.avatar_url) ? (
                <Image
                  src={(linkedProfile?.avatarUrl ?? member.avatar_url)!}
                  alt={member.first_name}
                  className="h-16 w-16 rounded-full object-cover"
                  width={64}
                  height={64}
                />
              ) : (
                <User className="text-primary h-8 w-8" />
              )}
            </div>
            {linkedProfile && (
              <div
                className="ring-background absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2"
                title={`Linked to ${linkedProfile.displayName}`}
              >
                <UserCheck className="text-foreground h-3 w-3" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">
              {member.first_name} {member.last_name}
            </h2>
            {member.maiden_name && (
              <p className="text-muted-foreground text-sm">n&eacute;e {member.maiden_name}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {member.is_deceased && <Badge variant="secondary">Deceased</Badge>}
              {member.gender && member.gender !== "unknown" && (
                <Badge variant="outline" className="capitalize">
                  {member.gender === "other" ? "Custom" : member.gender}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <MemberPermissionsSection
          treeId={treeId}
          memberId={member.id}
          memberFirstName={member.first_name}
          currentUserId={currentUserId}
          permissions={permissions}
          linkedProfile={linkedProfile}
        />

        <Separator />

        {/* All fields -- click to edit for admins */}
        <div className="space-y-3">
          <InlineField
            label="First name"
            value={member.first_name}
            field="first_name"
            lock={collaboratorLocks.first_name}
            {...fieldProps}
          />
          <InlineField
            label="Last name"
            value={member.last_name}
            field="last_name"
            lock={collaboratorLocks.last_name}
            {...fieldProps}
          />
          <InlineField
            label="Maiden name"
            value={member.maiden_name}
            field="maiden_name"
            lock={collaboratorLocks.maiden_name}
            {...fieldProps}
          />
          <InlineField
            label="Date of birth"
            value={member.date_of_birth}
            field="date_of_birth"
            type="date"
            lock={collaboratorLocks.date_of_birth}
            {...fieldProps}
          />
          <InlineField
            label="Birth place"
            value={member.birth_place}
            field="birth_place"
            lock={collaboratorLocks.birth_place}
            {...fieldProps}
          />
          {(member.is_deceased || member.date_of_death) && (
            <>
              <InlineField
                label="Date of death"
                value={member.date_of_death}
                field="date_of_death"
                type="date"
                lock={collaboratorLocks.date_of_death}
                {...fieldProps}
              />
              <InlineField
                label="Death place"
                value={member.death_place}
                field="death_place"
                lock={collaboratorLocks.death_place}
                {...fieldProps}
              />
            </>
          )}
          <InlineField
            label="Bio"
            value={member.bio}
            field="bio"
            type="textarea"
            lock={collaboratorLocks.bio}
            {...fieldProps}
          />
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
            lock={collaboratorLocks.gender}
            {...fieldProps}
          />
        </div>

        <Separator />

        {/* Relationships */}
        {/* eslint-disable react/no-children-prop -- `children` here refers to child relationships, not React children */}
        <MemberRelationshipsList
          parents={parents}
          spouses={spouses}
          children={children}
          siblings={siblings}
          stepParents={stepParents}
          stepChildren={stepChildren}
          inLaws={inLaws}
          guardians={guardians}
          wards={wards}
          canManage={memberCanEdit && !relationshipMutationLoading}
          onDeleteRelationship={handleDeleteRelationship}
          onChangeRelationshipType={handleChangeRelationshipType}
          onSelectMember={onSelectMember}
          onHoverMember={onHoverMember}
        />
        {/* eslint-enable react/no-children-prop */}

        <Separator />

        {/* Photos & Documents */}
        <MemberPhotoSection
          treeId={treeId}
          memberId={member.id}
          photos={photos}
          documents={documents}
          canEdit={memberCanEdit}
          onPhotosChange={setPhotos}
          onDocumentsChange={setDocuments}
        />

        <Separator />

        {/* Metadata */}
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>Added {formatDate(member.created_at)}</p>
          <p>Last updated {formatDate(member.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
