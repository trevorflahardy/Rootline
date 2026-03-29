"use client";

import { useState } from "react";
import Image from "next/image";
import { User, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TreeMember, RelationshipType } from "@/types";

export type RelationshipListDirection = "incoming" | "outgoing" | "peer";

export interface RelatedRelationshipItem {
  member: TreeMember;
  type: RelationshipType;
  relationshipId: string;
  fromMemberId: string;
  toMemberId: string;
  direction: RelationshipListDirection;
}

export function RelatedMemberCard({
  member,
  badge,
  relationshipType,
  relationshipId,
  fromMemberId,
  toMemberId,
  direction,
  canManage,
  onDeleteRelationship,
  onChangeRelationshipType,
  onSelect,
  onHover,
}: {
  member: TreeMember;
  badge?: string;
  relationshipType?: RelationshipType;
  relationshipId?: string;
  fromMemberId?: string;
  toMemberId?: string;
  direction?: RelationshipListDirection;
  canManage?: boolean;
  onDeleteRelationship?: (relationshipId: string) => Promise<void>;
  onChangeRelationshipType?: (input: {
    relationshipId: string;
    nextType: RelationshipType;
    relatedMemberId: string;
    currentType: RelationshipType;
    fromMemberId: string;
    toMemberId: string;
    direction: RelationshipListDirection;
  }) => Promise<void>;
  onSelect: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  const [updatingType, setUpdatingType] = useState(false);
  const [deletingRelationship, setDeletingRelationship] = useState(false);

  const canEditRelationship =
    !!canManage &&
    !!relationshipType &&
    !!relationshipId &&
    !!fromMemberId &&
    !!toMemberId &&
    !!direction;

  return (
    <div
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className="group glass-card glass-light hover:bg-foreground/10 dark:hover:bg-foreground/10 flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors"
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {member.avatar_url ? (
            <Image
              src={member.avatar_url}
              alt={member.first_name}
              className="h-8 w-8 rounded-full object-cover"
              width={32}
              height={32}
            />
          ) : (
            <User className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {member.first_name} {member.last_name}
          </p>
          {member.date_of_birth && (
            <p className="text-muted-foreground text-[10px]">
              {member.date_of_birth.substring(0, 4)}
              {member.is_deceased && member.date_of_death
                ? ` – ${member.date_of_death.substring(0, 4)}`
                : ""}
            </p>
          )}
        </div>
      </button>

      {badge && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {badge}
        </Badge>
      )}

      <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />

      {canEditRelationship &&
        onChangeRelationshipType &&
        relationshipType &&
        relationshipId &&
        fromMemberId &&
        toMemberId &&
        direction && (
          <div
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Select
              value={relationshipType}
              disabled={updatingType || deletingRelationship}
              onValueChange={async (nextType) => {
                if (nextType === relationshipType) return;
                setUpdatingType(true);
                try {
                  await onChangeRelationshipType({
                    relationshipId,
                    nextType: nextType as RelationshipType,
                    relatedMemberId: member.id,
                    currentType: relationshipType,
                    fromMemberId,
                    toMemberId,
                    direction,
                  });
                } finally {
                  setUpdatingType(false);
                }
              }}
            >
              <SelectTrigger className="h-7 w-[120px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent_child">Parent/Child</SelectItem>
                <SelectItem value="adopted">Adopted</SelectItem>
                <SelectItem value="spouse">Spouse</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="sibling">Sibling</SelectItem>
                <SelectItem value="step_parent">Step-Parent</SelectItem>
                <SelectItem value="step_child">Step-Child</SelectItem>
                <SelectItem value="in_law">In-Law</SelectItem>
                <SelectItem value="guardian">Guardian</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

      {canEditRelationship && onDeleteRelationship && relationshipId && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          disabled={deletingRelationship || updatingType}
          onClick={async (e) => {
            e.stopPropagation();
            setDeletingRelationship(true);
            try {
              await onDeleteRelationship(relationshipId);
            } finally {
              setDeletingRelationship(false);
            }
          }}
          title="Delete relationship"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface RelationshipSectionProps {
  label: string;
  items: RelatedRelationshipItem[];
  canManage: boolean;
  onDeleteRelationship: (relationshipId: string) => Promise<void>;
  onChangeRelationshipType: (input: {
    relationshipId: string;
    nextType: RelationshipType;
    relatedMemberId: string;
    currentType: RelationshipType;
    fromMemberId: string;
    toMemberId: string;
    direction: RelationshipListDirection;
  }) => Promise<void>;
  onSelectMember: (id: string) => void;
  onHoverMember?: (id: string | null) => void;
  badgeFn?: (item: RelatedRelationshipItem) => string | undefined;
}

function RelationshipSection({
  label,
  items,
  canManage,
  onDeleteRelationship,
  onChangeRelationshipType,
  onSelectMember,
  onHoverMember,
  badgeFn,
}: RelationshipSectionProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wider uppercase">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <RelatedMemberCard
            key={item.relationshipId}
            member={item.member}
            badge={badgeFn?.(item)}
            relationshipType={item.type}
            relationshipId={item.relationshipId}
            fromMemberId={item.fromMemberId}
            toMemberId={item.toMemberId}
            direction={item.direction}
            canManage={canManage}
            onDeleteRelationship={onDeleteRelationship}
            onChangeRelationshipType={onChangeRelationshipType}
            onSelect={() => onSelectMember(item.member.id)}
            onHover={(h) => onHoverMember?.(h ? item.member.id : null)}
          />
        ))}
      </div>
    </div>
  );
}

interface MemberRelationshipsListProps {
  parents: RelatedRelationshipItem[];
  spouses: RelatedRelationshipItem[];
  children: RelatedRelationshipItem[];
  siblings: RelatedRelationshipItem[];
  stepParents: RelatedRelationshipItem[];
  stepChildren: RelatedRelationshipItem[];
  inLaws: RelatedRelationshipItem[];
  guardians: RelatedRelationshipItem[];
  wards: RelatedRelationshipItem[];
  canManage: boolean;
  onDeleteRelationship: (relationshipId: string) => Promise<void>;
  onChangeRelationshipType: (input: {
    relationshipId: string;
    nextType: RelationshipType;
    relatedMemberId: string;
    currentType: RelationshipType;
    fromMemberId: string;
    toMemberId: string;
    direction: RelationshipListDirection;
  }) => Promise<void>;
  onSelectMember: (id: string) => void;
  onHoverMember?: (id: string | null) => void;
}

export function MemberRelationshipsList({
  parents,
  spouses,
  children,
  siblings,
  stepParents,
  stepChildren,
  inLaws,
  guardians,
  wards,
  canManage,
  onDeleteRelationship,
  onChangeRelationshipType,
  onSelectMember,
  onHoverMember,
}: MemberRelationshipsListProps) {
  const common = {
    canManage,
    onDeleteRelationship,
    onChangeRelationshipType,
    onSelectMember,
    onHoverMember,
  };
  const parentChildBadge = (item: RelatedRelationshipItem) =>
    item.type === "adopted" ? "Adopted" : undefined;
  const spouseBadge = (item: RelatedRelationshipItem) =>
    item.type === "divorced" ? "Divorced" : undefined;

  const hasAny =
    parents.length > 0 ||
    spouses.length > 0 ||
    children.length > 0 ||
    siblings.length > 0 ||
    stepParents.length > 0 ||
    stepChildren.length > 0 ||
    inLaws.length > 0 ||
    guardians.length > 0 ||
    wards.length > 0;

  return (
    <div className="space-y-4">
      <RelationshipSection label="Parents" items={parents} {...common} badgeFn={parentChildBadge} />
      <RelationshipSection label="Spouse" items={spouses} {...common} badgeFn={spouseBadge} />
      <RelationshipSection
        label="Children"
        items={children}
        {...common}
        badgeFn={parentChildBadge}
      />
      <RelationshipSection label="Siblings" items={siblings} {...common} />
      <RelationshipSection label="Step-Parents" items={stepParents} {...common} />
      <RelationshipSection label="Step-Children" items={stepChildren} {...common} />
      <RelationshipSection label="In-Laws" items={inLaws} {...common} />
      <RelationshipSection label="Guardians" items={guardians} {...common} />
      <RelationshipSection label="Wards" items={wards} {...common} />
      {!hasAny && (
        <p className="text-muted-foreground text-sm">No family relationships recorded yet.</p>
      )}
    </div>
  );
}
