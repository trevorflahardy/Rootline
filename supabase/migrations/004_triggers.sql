-- Rootline: Audit Log and Notification Triggers

-- Audit log trigger function for tree_members
CREATE OR REPLACE FUNCTION public.audit_tree_members()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.tree_id, public.requesting_user_id(), 'create', 'tree_member', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (NEW.tree_id, public.requesting_user_id(), 'update', 'tree_member', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.tree_id, public.requesting_user_id(), 'delete', 'tree_member', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_tree_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tree_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_tree_members();

-- Audit log trigger function for relationships
CREATE OR REPLACE FUNCTION public.audit_relationships()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.tree_id, public.requesting_user_id(), 'create', 'relationship', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (tree_id, user_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.tree_id, public.requesting_user_id(), 'delete', 'relationship', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_relationships_trigger
  AFTER INSERT OR DELETE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.audit_relationships();

-- Notification trigger: notify tree members on changes
CREATE OR REPLACE FUNCTION public.notify_tree_members()
RETURNS TRIGGER AS $$
DECLARE
  v_tree_id UUID;
  v_actor TEXT;
  v_message TEXT;
  v_type TEXT;
  v_entity_id UUID;
  v_member_name TEXT;
BEGIN
  v_actor := public.requesting_user_id();

  IF TG_TABLE_NAME = 'tree_members' THEN
    v_tree_id := COALESCE(NEW.tree_id, OLD.tree_id);
    v_entity_id := COALESCE(NEW.id, OLD.id);
    v_member_name := COALESCE(NEW.first_name, OLD.first_name);

    IF TG_OP = 'INSERT' THEN
      v_type := 'member_added';
      v_message := v_member_name || ' was added to the family tree';
    ELSIF TG_OP = 'UPDATE' THEN
      v_type := 'member_updated';
      v_message := v_member_name || '''s profile was updated';
    ELSIF TG_OP = 'DELETE' THEN
      v_type := 'member_removed';
      v_message := v_member_name || ' was removed from the family tree';
    END IF;
  ELSIF TG_TABLE_NAME = 'relationships' THEN
    v_tree_id := COALESCE(NEW.tree_id, OLD.tree_id);
    v_entity_id := COALESCE(NEW.id, OLD.id);

    IF TG_OP = 'INSERT' THEN
      v_type := 'relationship_added';
      v_message := 'A new relationship was added to the family tree';
    ELSIF TG_OP = 'DELETE' THEN
      v_type := 'relationship_removed';
      v_message := 'A relationship was removed from the family tree';
    END IF;
  END IF;

  -- Insert notifications for all tree members except the actor
  INSERT INTO public.notifications (tree_id, user_id, type, message, entity_id)
  SELECT v_tree_id, tm.user_id, v_type, v_message, v_entity_id
  FROM public.tree_memberships tm
  WHERE tm.tree_id = v_tree_id
    AND tm.user_id != COALESCE(v_actor, '');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tree_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_tree_members();

CREATE TRIGGER notify_on_relationship_change
  AFTER INSERT OR DELETE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.notify_tree_members();
