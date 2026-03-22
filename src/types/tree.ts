export interface FamilyTree {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface TreeSummary {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  member_count: number;
  role: TreeRole;
  updated_at: string;
}

export type TreeRole = "owner" | "editor" | "viewer";

export interface TreeMembership {
  id: string;
  tree_id: string;
  user_id: string;
  role: TreeRole;
  linked_node_id: string | null;
  joined_at: string;
}
