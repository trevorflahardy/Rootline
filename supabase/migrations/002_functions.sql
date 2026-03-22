-- Rootline: Database Functions

-- Function to get the requesting user ID from session variable
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::TEXT;
$$ LANGUAGE sql STABLE;

-- Function to set the requesting user ID (called from server actions)
CREATE OR REPLACE FUNCTION public.set_request_user_id(user_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;

-- Check if a node is a descendant of an ancestor in a tree
CREATE OR REPLACE FUNCTION public.is_descendant_of(
  p_tree_id UUID,
  p_node_id UUID,
  p_ancestor_id UUID
) RETURNS BOOLEAN AS $$
  WITH RECURSIVE descendants AS (
    SELECT to_member_id AS id
    FROM public.relationships
    WHERE tree_id = p_tree_id
      AND from_member_id = p_ancestor_id
      AND relationship_type = 'parent_child'
    UNION
    SELECT r.to_member_id
    FROM public.relationships r
    INNER JOIN descendants d ON r.from_member_id = d.id
    WHERE r.tree_id = p_tree_id
      AND r.relationship_type = 'parent_child'
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE id = p_node_id)
    OR p_node_id = p_ancestor_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is a member of a tree
CREATE OR REPLACE FUNCTION public.is_tree_member(p_tree_id UUID, p_user_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = p_tree_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE;

-- Helper: check if user is the owner of a tree
CREATE OR REPLACE FUNCTION public.is_tree_owner(p_tree_id UUID, p_user_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = p_tree_id AND user_id = p_user_id AND role = 'owner'
  );
$$ LANGUAGE sql STABLE;

-- Helper: get the linked node ID for a user in a tree
CREATE OR REPLACE FUNCTION public.get_linked_node_id(p_tree_id UUID, p_user_id TEXT)
RETURNS UUID AS $$
  SELECT linked_node_id FROM public.tree_memberships
  WHERE tree_id = p_tree_id AND user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Helper: check if user can edit a specific node (owner OR editor with descendant scope)
CREATE OR REPLACE FUNCTION public.can_edit_node(p_tree_id UUID, p_user_id TEXT, p_node_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    public.is_tree_owner(p_tree_id, p_user_id)
    OR (
      EXISTS (
        SELECT 1 FROM public.tree_memberships
        WHERE tree_id = p_tree_id AND user_id = p_user_id AND role = 'editor'
      )
      AND public.is_descendant_of(
        p_tree_id,
        p_node_id,
        public.get_linked_node_id(p_tree_id, p_user_id)
      )
    );
$$ LANGUAGE sql STABLE;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_family_trees_updated_at
  BEFORE UPDATE ON public.family_trees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_tree_members_updated_at
  BEFORE UPDATE ON public.tree_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
