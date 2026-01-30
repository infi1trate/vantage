-- Make voice-notes and session-thumbnails buckets private
UPDATE storage.buckets SET public = false WHERE id = 'voice-notes';
UPDATE storage.buckets SET public = false WHERE id = 'session-thumbnails';