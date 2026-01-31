-- Add columns to track Dropbox upload session state for resumable uploads
ALTER TABLE public.dropbox_sync_status
ADD COLUMN IF NOT EXISTS upload_session_id text,
ADD COLUMN IF NOT EXISTS upload_offset bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS upload_total_bytes bigint,
ADD COLUMN IF NOT EXISTS upload_session_started_at timestamp with time zone;