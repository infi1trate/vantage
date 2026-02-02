-- Add preview_status column to track optional preview generation separately
-- Preview is now a background job that doesn't block "ready" status

-- Preview status enum: pending, rendering, ready, failed
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS preview_status text DEFAULT 'pending' CHECK (preview_status IN ('pending', 'rendering', 'ready', 'failed'));

-- Add index for filtering reels by preview status
CREATE INDEX IF NOT EXISTS idx_reels_preview_status ON public.reels(preview_status);

COMMENT ON COLUMN public.reels.preview_status IS 'Status of optional preview video generation. Reel can be ready even if preview is pending/failed.';