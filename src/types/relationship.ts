export type RelationshipType = "parent_child" | "spouse" | "divorced" | "adopted";

export interface Relationship {
  id: string;
  tree_id: string;
  from_member_id: string;
  to_member_id: string;
  relationship_type: RelationshipType;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}
