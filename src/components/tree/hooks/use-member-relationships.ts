import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteRelationship, updateRelationship } from "@/lib/actions/relationship";
import type { TreeMember, Relationship, RelationshipType } from "@/types";
import type {
  RelatedRelationshipItem,
  RelationshipListDirection,
} from "../member-relationships-list";

interface UseMemberRelationshipsOptions {
  member: TreeMember;
  relationships: Relationship[];
  allMembers: TreeMember[];
  treeId: string;
}

export function useMemberRelationships({
  member,
  relationships,
  allMembers,
  treeId,
}: UseMemberRelationshipsOptions) {
  const router = useRouter();
  const [relationshipMutationLoading, setRelationshipMutationLoading] = useState(false);
  const memberMap = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);

  // Find parents, children, spouses, and extended relationships
  const parents = relationships
    .filter(
      (r) =>
        r.to_member_id === member.id &&
        (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
    )
    .map((r) => ({
      member: memberMap.get(r.from_member_id),
      type: r.relationship_type,
      relationshipId: r.id,
      fromMemberId: r.from_member_id,
      toMemberId: r.to_member_id,
      direction: "incoming" as RelationshipListDirection,
    }))
    .filter((p) => p.member) as RelatedRelationshipItem[];

  const children = relationships
    .filter(
      (r) =>
        r.from_member_id === member.id &&
        (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
    )
    .map((r) => ({
      member: memberMap.get(r.to_member_id),
      type: r.relationship_type,
      relationshipId: r.id,
      fromMemberId: r.from_member_id,
      toMemberId: r.to_member_id,
      direction: "outgoing" as RelationshipListDirection,
    }))
    .filter((c) => c.member) as RelatedRelationshipItem[];

  const spouseMap = new Map<string, RelatedRelationshipItem>();
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
        fromMemberId: rel.from_member_id,
        toMemberId: rel.to_member_id,
        direction: "peer",
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
      return {
        member: memberMap.get(otherId),
        type: r.relationship_type,
        relationshipId: r.id,
        fromMemberId: r.from_member_id,
        toMemberId: r.to_member_id,
        direction: "peer" as RelationshipListDirection,
      };
    })
    .filter((s) => s.member) as RelatedRelationshipItem[];

  const stepParents = relationships
    .filter(
      (r) =>
        (r.to_member_id === member.id && r.relationship_type === "step_parent") ||
        (r.from_member_id === member.id && r.relationship_type === "step_child")
    )
    .map((r) => {
      const parentId = r.relationship_type === "step_parent" ? r.from_member_id : r.to_member_id;
      return {
        member: memberMap.get(parentId),
        type: r.relationship_type,
        relationshipId: r.id,
        fromMemberId: r.from_member_id,
        toMemberId: r.to_member_id,
        direction: "incoming" as RelationshipListDirection,
      };
    })
    .filter((s) => s.member) as RelatedRelationshipItem[];

  const stepChildren = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id && r.relationship_type === "step_parent") ||
        (r.to_member_id === member.id && r.relationship_type === "step_child")
    )
    .map((r) => {
      const childId = r.relationship_type === "step_parent" ? r.to_member_id : r.from_member_id;
      return {
        member: memberMap.get(childId),
        type: r.relationship_type,
        relationshipId: r.id,
        fromMemberId: r.from_member_id,
        toMemberId: r.to_member_id,
        direction: "outgoing" as RelationshipListDirection,
      };
    })
    .filter((s) => s.member) as RelatedRelationshipItem[];

  const inLaws = relationships
    .filter(
      (r) =>
        (r.from_member_id === member.id || r.to_member_id === member.id) &&
        r.relationship_type === "in_law"
    )
    .map((r) => {
      const otherId = r.from_member_id === member.id ? r.to_member_id : r.from_member_id;
      return {
        member: memberMap.get(otherId),
        type: r.relationship_type,
        relationshipId: r.id,
        fromMemberId: r.from_member_id,
        toMemberId: r.to_member_id,
        direction: "peer" as RelationshipListDirection,
      };
    })
    .filter((s) => s.member) as RelatedRelationshipItem[];

  const guardians = relationships
    .filter((r) => r.to_member_id === member.id && r.relationship_type === "guardian")
    .map((r) => ({
      member: memberMap.get(r.from_member_id),
      type: r.relationship_type,
      relationshipId: r.id,
      fromMemberId: r.from_member_id,
      toMemberId: r.to_member_id,
      direction: "incoming" as RelationshipListDirection,
    }))
    .filter((g) => g.member) as RelatedRelationshipItem[];

  const wards = relationships
    .filter((r) => r.from_member_id === member.id && r.relationship_type === "guardian")
    .map((r) => ({
      member: memberMap.get(r.to_member_id),
      type: r.relationship_type,
      relationshipId: r.id,
      fromMemberId: r.from_member_id,
      toMemberId: r.to_member_id,
      direction: "outgoing" as RelationshipListDirection,
    }))
    .filter((w) => w.member) as RelatedRelationshipItem[];

  const handleDeleteRelationship = useCallback(
    async (relationshipId: string) => {
      setRelationshipMutationLoading(true);
      try {
        await deleteRelationship(relationshipId, treeId);
        toast.success("Relationship deleted");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete relationship");
      } finally {
        setRelationshipMutationLoading(false);
      }
    },
    [router, treeId]
  );

  const handleChangeRelationshipType = useCallback(
    async ({
      relationshipId,
      nextType,
      relatedMemberId,
      fromMemberId,
      toMemberId,
      direction,
    }: {
      relationshipId: string;
      nextType: RelationshipType;
      relatedMemberId: string;
      currentType: RelationshipType;
      fromMemberId: string;
      toMemberId: string;
      direction: RelationshipListDirection;
    }) => {
      const directedTypes: RelationshipType[] = [
        "parent_child",
        "adopted",
        "step_parent",
        "guardian",
        "step_child",
      ];
      const isDirectedType = directedTypes.includes(nextType);

      let nextFrom = fromMemberId;
      let nextTo = toMemberId;

      if (!isDirectedType) {
        nextFrom = member.id;
        nextTo = relatedMemberId;
      } else if (nextType === "step_child") {
        if (direction === "incoming") {
          nextFrom = member.id;
          nextTo = relatedMemberId;
        } else if (direction === "outgoing") {
          nextFrom = relatedMemberId;
          nextTo = member.id;
        }
      } else {
        if (direction === "incoming") {
          nextFrom = relatedMemberId;
          nextTo = member.id;
        } else if (direction === "outgoing") {
          nextFrom = member.id;
          nextTo = relatedMemberId;
        }
      }

      setRelationshipMutationLoading(true);
      try {
        await updateRelationship({
          relationship_id: relationshipId,
          tree_id: treeId,
          from_member_id: nextFrom,
          to_member_id: nextTo,
          relationship_type: nextType,
        });
        toast.success("Relationship updated");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update relationship");
      } finally {
        setRelationshipMutationLoading(false);
      }
    },
    [member.id, router, treeId]
  );

  return {
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
  };
}
