-- Add new fields to challenges table for enhanced card display
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS difficulty INTEGER DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
ADD COLUMN IF NOT EXISTS prize_crypto TEXT,
ADD COLUMN IF NOT EXISTS prize_crypto_amount DECIMAL(18, 8),
ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sponsor_name TEXT,
ADD COLUMN IF NOT EXISTS preview_video_url TEXT,
ADD COLUMN IF NOT EXISTS submission_count INTEGER DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_challenges_is_sponsored ON public.challenges(is_sponsored) WHERE is_sponsored = true;