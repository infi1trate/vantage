-- Add 'uploading' status to capture_sessions status check constraint
-- This is needed for desktop recordings that are being uploaded

-- Drop the existing constraint
ALTER TABLE public.capture_sessions DROP CONSTRAINT capture_sessions_status_check;

-- Add the new constraint with 'uploading' included
ALTER TABLE public.capture_sessions 
ADD CONSTRAINT capture_sessions_status_check 
CHECK (status = ANY (ARRAY['recording'::text, 'uploading'::text, 'processing'::text, 'ready'::text, 'failed'::text]));