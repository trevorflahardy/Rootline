-- Rootline: Initial Database Schema
-- Run this first in your Supabase SQL Editor

-- Profiles (synced from Clerk via webhook)
CREATE TABLE public.profiles (
  clerk_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Family Trees
CREATE TABLE public.family_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tree Members (nodes representing people)
CREATE TABLE public.tree_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  maiden_name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  date_of_birth DATE,
  date_of_death DATE,
  birth_place TEXT,
  death_place TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_deceased BOOLEAN NOT NULL DEFAULT false,
  position_x FLOAT,
  position_y FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT REFERENCES public.profiles(clerk_id)
);

-- Relationships between tree members
CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES public.tree_members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES public.tree_members(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent_child', 'spouse', 'divorced', 'adopted')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tree_id, from_member_id, to_member_id, relationship_type)
);

-- Tree Memberships (account-to-tree access with roles)
CREATE TABLE public.tree_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'viewer',
  linked_node_id UUID REFERENCES public.tree_members(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tree_id, user_id)
);

-- Invitations
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by TEXT NOT NULL REFERENCES public.profiles(clerk_id),
  target_node_id UUID REFERENCES public.tree_members(id) ON DELETE SET NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')) DEFAULT 'editor',
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.profiles(clerk_id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Media (photos)
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES public.profiles(clerk_id),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  member_id UUID REFERENCES public.tree_members(id) ON DELETE SET NULL,
  is_profile_photo BOOLEAN NOT NULL DEFAULT false,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tree Snapshots (for version rollback)
CREATE TABLE public.tree_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES public.profiles(clerk_id),
  snapshot_data JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(clerk_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tree_members_tree_id ON public.tree_members(tree_id);
CREATE INDEX idx_relationships_tree_id ON public.relationships(tree_id);
CREATE INDEX idx_relationships_from ON public.relationships(from_member_id);
CREATE INDEX idx_relationships_to ON public.relationships(to_member_id);
CREATE INDEX idx_tree_memberships_user ON public.tree_memberships(user_id);
CREATE INDEX idx_tree_memberships_tree ON public.tree_memberships(tree_id);
CREATE INDEX idx_audit_log_tree ON public.audit_log(tree_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(tree_id, created_at DESC);
CREATE INDEX idx_invitations_code ON public.invitations(invite_code);
CREATE INDEX idx_media_tree ON public.media(tree_id);
CREATE INDEX idx_media_member ON public.media(member_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_tree ON public.notifications(tree_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
