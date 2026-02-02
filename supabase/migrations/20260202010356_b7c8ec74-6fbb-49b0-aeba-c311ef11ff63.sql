-- Reels Table: First-class Reel objects
-- Reels are distinct from sessions - they represent edited clips with effects
CREATE TABLE public.reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  
  -- Basic info
  title TEXT NOT NULL DEFAULT 'Untitled Reel',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9', -- '16:9', '9:16', '1:1'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'rendering', 'ready', 'failed'
  
  -- Source moments (annotation IDs that make up this reel)
  source_moment_ids UUID[] DEFAULT '{}',
  
  -- Computed metadata
  duration_seconds NUMERIC,
  thumbnail_url TEXT,
  
  -- Output assets
  preview_url TEXT, -- Low-res preview
  output_url TEXT, -- Final rendered video
  output_file_size_bytes BIGINT,
  
  -- Render tracking
  render_started_at TIMESTAMP WITH TIME ZONE,
  render_completed_at TIMESTAMP WITH TIME ZONE,
  render_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Users can only access their own reels
CREATE POLICY "Users can view their own reels"
ON public.reels FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reels"
ON public.reels FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reels"
ON public.reels FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels"
ON public.reels FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_reels_user_id ON public.reels(user_id);
CREATE INDEX idx_reels_session_id ON public.reels(session_id);

-- Update reel_package_configs to reference reels table properly
-- Add foreign key constraint (reel_id already exists, just add constraint)
ALTER TABLE public.reel_package_configs
ADD CONSTRAINT reel_package_configs_reel_id_fkey
FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;

-- Update effect_events to have proper foreign key to reels
ALTER TABLE public.effect_events
ADD CONSTRAINT effect_events_reel_id_fkey
FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;

-- Update frame_overlays to reference reels (add reel_id column)
ALTER TABLE public.frame_overlays
ADD COLUMN reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE;

-- Trigger for updated_at
CREATE TRIGGER update_reels_updated_at
BEFORE UPDATE ON public.reels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();