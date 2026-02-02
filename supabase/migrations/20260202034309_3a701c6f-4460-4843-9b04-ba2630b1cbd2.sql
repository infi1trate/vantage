-- Add assembly_attempt_id to track which attempt is current
-- This prevents stale job updates from affecting the UI

ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS assembly_attempt_id uuid DEFAULT NULL;

-- Add index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_reels_assembly_attempt_id ON public.reels(assembly_attempt_id);

COMMENT ON COLUMN public.reels.assembly_attempt_id IS 'Unique ID for the current assembly attempt. Prevents stale job updates from affecting UI.';