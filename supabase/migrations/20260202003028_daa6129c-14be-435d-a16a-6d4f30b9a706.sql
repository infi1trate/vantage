-- Reel Package Configurations Table
-- Stores AI-generated intro/outro/transition settings for reels
CREATE TABLE public.reel_package_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  reel_id UUID, -- Optional: link to specific reel if applicable
  
  -- Feature toggles
  enabled_intro BOOLEAN DEFAULT false,
  enabled_outro BOOLEAN DEFAULT false,
  enabled_transitions BOOLEAN DEFAULT false,
  
  -- Style configuration
  style_key TEXT NOT NULL DEFAULT 'auto' CHECK (style_key IN ('auto', 'minimalPro', 'cinematic', 'meme', 'neon', 'retro', 'hype')),
  
  -- Audio configuration
  audio_mode TEXT NOT NULL DEFAULT 'gameAudioOnly' CHECK (audio_mode IN ('gameAudioOnly', 'musicBed', 'hybrid')),
  beat_source TEXT NOT NULL DEFAULT 'gameAudio' CHECK (beat_source IN ('music', 'gameAudio')),
  
  -- Energy profile (computed from clip analysis)
  energy_profile JSONB DEFAULT '{"paceScore": 50, "loudnessScore": 50, "cutScore": 50}'::jsonb,
  
  -- Stats overlay
  stat_overlay_enabled BOOLEAN DEFAULT true,
  
  -- Generated assets (references to storage/CDN)
  intro_asset_id UUID,
  outro_asset_id UUID,
  transition_asset_ids UUID[] DEFAULT '{}',
  
  -- Generation metadata
  generation_metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: { "prompt": "...", "model": "gpt-4-vision", "createdAt": "2024-...", "status": "pending|generating|ready|failed" }
  
  -- Generation status for progressive preview
  generation_status TEXT DEFAULT 'idle' CHECK (generation_status IN ('idle', 'pending', 'generating', 'ready', 'failed')),
  generation_progress INTEGER DEFAULT 0 CHECK (generation_progress >= 0 AND generation_progress <= 100),
  generation_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reel_package_configs_user ON public.reel_package_configs(user_id);
CREATE INDEX idx_reel_package_configs_session ON public.reel_package_configs(session_id);
CREATE INDEX idx_reel_package_configs_status ON public.reel_package_configs(generation_status);

-- Enable RLS
ALTER TABLE public.reel_package_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own reel packages"
ON public.reel_package_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reel packages"
ON public.reel_package_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reel packages"
ON public.reel_package_configs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reel packages"
ON public.reel_package_configs FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_reel_package_configs_updated_at
BEFORE UPDATE ON public.reel_package_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();