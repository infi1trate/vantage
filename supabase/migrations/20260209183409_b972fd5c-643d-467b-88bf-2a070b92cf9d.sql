-- Make session-thumbnails bucket public so thumbnails can be displayed
UPDATE storage.buckets SET public = true WHERE id = 'session-thumbnails';

-- Allow anyone to view session thumbnails (public bucket)
CREATE POLICY "Session thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'session-thumbnails');

-- Allow authenticated users to upload thumbnails scoped to their user folder
CREATE POLICY "Users can upload session thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'session-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to overwrite their own thumbnails (upsert)
CREATE POLICY "Users can update their own session thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'session-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);