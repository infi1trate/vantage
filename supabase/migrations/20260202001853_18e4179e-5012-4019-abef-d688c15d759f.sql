-- Effect Events Table
-- Stores VFX/SFX as timeline metadata for post-processing/export
CREATE TABLE public.effect_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  
  -- Effect type and identification
  type TEXT NOT NULL CHECK (type IN ('vfx', 'sfx')),
  key TEXT NOT NULL, -- e.g. 'screenShake', 'zoomPunch', 'freezeFrame', 'hitmarker', 'bassDrop'
  
  -- Timeline positioning
  start_time_ms INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 500,
  
  -- Effect parameters (stored as JSONB for flexibility)
  intensity TEXT CHECK (intensity IN ('low', 'med', 'high')), -- VFX only
  volume INTEGER CHECK (volume >= 0 AND volume <= 100), -- SFX only, 0-100
  params JSONB DEFAULT '{}'::jsonb, -- Additional effect-specific params
  
  -- Scope: what this effect applies to
  apply_scope TEXT NOT NULL DEFAULT 'session' CHECK (apply_scope IN ('clip', 'reel', 'session')),
  clip_id UUID, -- If apply_scope = 'clip'
  reel_id UUID, -- If apply_scope = 'reel'
  
  -- Snapping metadata for smart placement
  snap_source TEXT CHECK (snap_source IN ('moment', 'audioPeak', 'manual')),
  snapped_to_id UUID, -- Reference to moment/peak that triggered snap
  
  -- Metadata
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_effect_events_session ON public.effect_events(session_id);
CREATE INDEX idx_effect_events_user ON public.effect_events(user_id);
CREATE INDEX idx_effect_events_timeline ON public.effect_events(session_id, start_time_ms);
CREATE INDEX idx_effect_events_type ON public.effect_events(type);

-- Enable Row Level Security
ALTER TABLE public.effect_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create own effect events"
  ON public.effect_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own effect events"
  ON public.effect_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own effect events"
  ON public.effect_events
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own effect events"
  ON public.effect_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow viewing shared session effect events
CREATE POLICY "Users can view shared session effect events"
  ON public.effect_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_shares
      WHERE session_shares.session_id = effect_events.session_id
      AND (session_shares.shared_with = auth.uid() OR session_shares.share_token IS NOT NULL)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_effect_events_updated_at
  BEFORE UPDATE ON public.effect_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();