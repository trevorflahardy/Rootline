CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES public.family_trees(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.tree_members(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES public.profiles(clerk_id),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'birth_certificate', 'marriage_license', 'death_certificate',
    'immigration', 'legal', 'medical', 'photo_album', 'other'
  )),
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_tree_id ON public.documents(tree_id);
CREATE INDEX idx_documents_member_id ON public.documents(member_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
