
-- Add required_moments_count to challenges (how many moments a single entry needs)
ALTER TABLE public.challenges
ADD COLUMN required_moments_count integer NOT NULL DEFAULT 1;

-- Add moments JSONB array to challenge_submissions (stores array of moment objects)
-- Each element: { annotation_id, annotation_type, label, timestamp_seconds, clip_start_ms, clip_end_ms }
ALTER TABLE public.challenge_submissions
ADD COLUMN moments jsonb DEFAULT NULL;
