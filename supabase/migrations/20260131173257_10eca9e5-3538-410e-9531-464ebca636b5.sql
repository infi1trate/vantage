-- Add tracking columns for sync attempts
ALTER TABLE public.dropbox_sync_status
ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS method_used text,
ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0;