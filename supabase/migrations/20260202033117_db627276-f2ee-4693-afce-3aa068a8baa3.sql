-- Add attempt tracking for assembly retries
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS job_id text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.reels.attempt_count IS 'Number of assembly attempts made for this reel';
COMMENT ON COLUMN public.reels.job_id IS 'Unique identifier for current assembly job to prevent duplicates';