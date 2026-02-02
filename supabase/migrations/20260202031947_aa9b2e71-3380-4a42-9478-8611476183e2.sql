-- Add assembly step instrumentation to reels table
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS assembly_step text DEFAULT 'collecting_clips',
ADD COLUMN IF NOT EXISTS step_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS step_completed_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.reels.assembly_step IS 'Current assembly step: collecting_clips, stitching_sequence, rendering_preview, finalizing_manifest, ready, failed';
COMMENT ON COLUMN public.reels.step_started_at IS 'When the current assembly step started';
COMMENT ON COLUMN public.reels.step_completed_at IS 'When the current assembly step completed';