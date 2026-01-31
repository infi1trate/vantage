-- Add columns for automatic retry scheduling
ALTER TABLE public.dropbox_sync_status
ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 5;