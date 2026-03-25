-- Expand audit coverage to tree settings, permissions, invites, and relationship updates.

-- Remove legacy audit triggers/functions.
DROP TRIGGER IF EXISTS audit_tree_members_trigger ON public.tree_members;
DROP TRIGGER IF EXISTS audit_relationships_trigger ON public.relationships;
DROP FUNCTION IF EXISTS public.audit_tree_members();
DROP FUNCTION IF EXISTS public.audit_relationships();

-- Generic audit trigger for entity tables.
CREATE OR REPLACE FUNCTION public.audit_entity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT := lower(TG_OP);
  v_entity_type TEXT := COALESCE(NULLIF(TG_ARGV[0], ''), TG_TABLE_NAME);
  v_entity_id UUID := COALESCE(NEW.id, OLD.id);
  v_tree_id UUID;
BEGIN
  -- family_trees is the root tree record, so its id is the tree id.
  IF TG_TABLE_NAME = 'family_trees' THEN
    v_tree_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_tree_id := COALESCE(NEW.tree_id, OLD.tree_id);
  END IF;

  IF v_tree_id IS NULL OR v_entity_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, new_data)
    VALUES (v_tree_id, public.requesting_user_id(), 'create', v_entity_type, v_entity_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (v_tree_id, public.requesting_user_id(), 'update', v_entity_type, v_entity_id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, old_data)
    VALUES (v_tree_id, public.requesting_user_id(), 'delete', v_entity_type, v_entity_id, to_jsonb(OLD));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Members
CREATE TRIGGER audit_tree_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tree_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_change('tree_member');

-- Connections (including edits to type/direction)
CREATE TRIGGER audit_relationships_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_change('relationship');

-- Tree settings (name, description, visibility, ownership lifecycle)
CREATE TRIGGER audit_family_trees_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.family_trees
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_change('family_tree');

-- Tree permissions/memberships (role/link changes and removals)
CREATE TRIGGER audit_tree_memberships_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tree_memberships
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_change('tree_membership');

-- Invite lifecycle (create/revoke/consume updates)
CREATE TRIGGER audit_invitations_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_change('invitation');
