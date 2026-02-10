
-- Add required moments range and label to challenges
ALTER TABLE public.challenges
ADD COLUMN required_moments_min integer NOT NULL DEFAULT 1,
ADD COLUMN required_moments_max integer NOT NULL DEFAULT 1,
ADD COLUMN moment_label text DEFAULT NULL;
