-- Create a public storage bucket for community post thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-thumbnails', 'community-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload thumbnails (scoped to their own folder)
CREATE POLICY "Users can upload community thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read access for community thumbnails
CREATE POLICY "Community thumbnails are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-thumbnails');

-- Allow users to delete their own community thumbnails
CREATE POLICY "Users can delete own community thumbnails"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
