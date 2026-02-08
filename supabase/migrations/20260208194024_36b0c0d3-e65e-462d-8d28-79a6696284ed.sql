
-- Create a public storage bucket for challenge hero images
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-assets', 'challenge-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view challenge assets (public bucket)
CREATE POLICY "Challenge assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'challenge-assets');

-- Allow authenticated users to upload challenge assets
CREATE POLICY "Authenticated users can upload challenge assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'challenge-assets' AND auth.role() = 'authenticated');

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own challenge assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'challenge-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own challenge assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'challenge-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
