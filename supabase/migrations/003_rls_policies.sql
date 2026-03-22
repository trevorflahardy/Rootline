-- Rootline: Row Level Security Policies

-- Profiles: anyone can read, only own profile can be updated
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (clerk_id = public.requesting_user_id());

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (true); -- Webhook inserts via admin client

-- Family Trees: read if member or public, write if owner
CREATE POLICY family_trees_select ON public.family_trees
  FOR SELECT USING (
    is_public = true
    OR public.is_tree_member(id, public.requesting_user_id())
  );

CREATE POLICY family_trees_insert ON public.family_trees
  FOR INSERT WITH CHECK (owner_id = public.requesting_user_id());

CREATE POLICY family_trees_update ON public.family_trees
  FOR UPDATE USING (public.is_tree_owner(id, public.requesting_user_id()));

CREATE POLICY family_trees_delete ON public.family_trees
  FOR DELETE USING (public.is_tree_owner(id, public.requesting_user_id()));

-- Tree Members: read if tree member, write if can edit node
CREATE POLICY tree_members_select ON public.tree_members
  FOR SELECT USING (
    public.is_tree_member(tree_id, public.requesting_user_id())
    OR EXISTS (SELECT 1 FROM public.family_trees WHERE id = tree_id AND is_public = true)
  );

CREATE POLICY tree_members_insert ON public.tree_members
  FOR INSERT WITH CHECK (
    public.is_tree_owner(tree_id, public.requesting_user_id())
    OR (
      EXISTS (
        SELECT 1 FROM public.tree_memberships
        WHERE tree_id = tree_members.tree_id
          AND user_id = public.requesting_user_id()
          AND role = 'editor'
      )
    )
  );

CREATE POLICY tree_members_update ON public.tree_members
  FOR UPDATE USING (
    public.can_edit_node(tree_id, public.requesting_user_id(), id)
  );

CREATE POLICY tree_members_delete ON public.tree_members
  FOR DELETE USING (
    public.can_edit_node(tree_id, public.requesting_user_id(), id)
  );

-- Relationships: read if tree member, write if can edit involved nodes
CREATE POLICY relationships_select ON public.relationships
  FOR SELECT USING (
    public.is_tree_member(tree_id, public.requesting_user_id())
    OR EXISTS (SELECT 1 FROM public.family_trees WHERE id = tree_id AND is_public = true)
  );

CREATE POLICY relationships_insert ON public.relationships
  FOR INSERT WITH CHECK (
    public.is_tree_owner(tree_id, public.requesting_user_id())
    OR (
      EXISTS (
        SELECT 1 FROM public.tree_memberships
        WHERE tree_id = relationships.tree_id
          AND user_id = public.requesting_user_id()
          AND role = 'editor'
      )
    )
  );

CREATE POLICY relationships_delete ON public.relationships
  FOR DELETE USING (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

-- Tree Memberships: read own or if tree member, insert/update by owner
CREATE POLICY tree_memberships_select ON public.tree_memberships
  FOR SELECT USING (
    user_id = public.requesting_user_id()
    OR public.is_tree_owner(tree_id, public.requesting_user_id())
  );

CREATE POLICY tree_memberships_insert ON public.tree_memberships
  FOR INSERT WITH CHECK (true); -- Handled via admin client (invite acceptance)

CREATE POLICY tree_memberships_update ON public.tree_memberships
  FOR UPDATE USING (
    public.is_tree_owner(tree_id, public.requesting_user_id())
    OR user_id = public.requesting_user_id()
  );

CREATE POLICY tree_memberships_delete ON public.tree_memberships
  FOR DELETE USING (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

-- Invitations: only owner can manage
CREATE POLICY invitations_select ON public.invitations
  FOR SELECT USING (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

CREATE POLICY invitations_insert ON public.invitations
  FOR INSERT WITH CHECK (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

CREATE POLICY invitations_delete ON public.invitations
  FOR DELETE USING (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

-- Audit Log: readable by tree members
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (
    public.is_tree_member(tree_id, public.requesting_user_id())
  );

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (true); -- Inserted via triggers

-- Media: read if tree member, write if editor with scope
CREATE POLICY media_select ON public.media
  FOR SELECT USING (
    public.is_tree_member(tree_id, public.requesting_user_id())
    OR EXISTS (SELECT 1 FROM public.family_trees WHERE id = tree_id AND is_public = true)
  );

CREATE POLICY media_insert ON public.media
  FOR INSERT WITH CHECK (
    public.is_tree_member(tree_id, public.requesting_user_id())
  );

CREATE POLICY media_delete ON public.media
  FOR DELETE USING (
    uploaded_by = public.requesting_user_id()
    OR public.is_tree_owner(tree_id, public.requesting_user_id())
  );

-- Tree Snapshots: owner only
CREATE POLICY tree_snapshots_select ON public.tree_snapshots
  FOR SELECT USING (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

CREATE POLICY tree_snapshots_insert ON public.tree_snapshots
  FOR INSERT WITH CHECK (
    public.is_tree_owner(tree_id, public.requesting_user_id())
  );

-- Notifications: own only
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (user_id = public.requesting_user_id());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (user_id = public.requesting_user_id());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (true); -- Inserted via triggers
