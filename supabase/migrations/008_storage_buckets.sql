-- Rootline: Storage Bucket Setup
-- Creates the two storage buckets used by the application.
-- NOTE: All uploads use the service-role admin client which bypasses RLS.
-- Access control is enforced at the application layer (photo.ts, document.ts).

-- Create tree-photos bucket (public: photos served via public URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tree-photos',
  'tree-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create tree-documents bucket (private: accessed via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tree-documents',
  'tree-documents',
  false,
  26214400, -- 25 MB
  NULL -- all mime types allowed; validated in application layer
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
-- Public read access for tree-photos (bucket is public, URLs are openly accessible)
CREATE POLICY "tree_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'tree-photos');

-- Authenticated users can insert into tree-photos (further scoped in application layer)
CREATE POLICY "tree_photos_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tree-photos'
    AND auth.role() IN ('authenticated', 'service_role')
  );

-- Only uploader or service role can delete tree-photos
CREATE POLICY "tree_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tree-photos'
    AND (auth.uid() = owner OR auth.role() = 'service_role')
  );

-- tree-documents: no public read (service role handles all access via signed URLs)
CREATE POLICY "tree_documents_service_role" ON storage.objects
  FOR ALL USING (
    bucket_id = 'tree-documents'
    AND auth.role() = 'service_role'
  );
