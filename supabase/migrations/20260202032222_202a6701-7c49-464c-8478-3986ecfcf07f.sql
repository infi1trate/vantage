-- Add manifest and playback fields for deterministic assembly completion
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS manifest jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preview_ref text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS playback_mode text DEFAULT 'preview',
ADD COLUMN IF NOT EXISTS total_duration_ms integer DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.reels.manifest IS 'Ordered list of clips with durations and metadata for playback';
COMMENT ON COLUMN public.reels.preview_ref IS 'Reference to rendered preview video (null if preview unavailable)';
COMMENT ON COLUMN public.reels.playback_mode IS 'Playback strategy: preview (rendered video) or manifest (stitch on export)';
COMMENT ON COLUMN public.reels.total_duration_ms IS 'Total duration of the reel in milliseconds';