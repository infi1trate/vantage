-- Frame Overlays Table
-- Stores frame overlay configurations as metadata (applied during export, not capture)
CREATE TABLE public.frame_overlays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  
  -- Frame type
  type TEXT NOT NULL DEFAULT 'preset' CHECK (type IN ('preset', 'ai', 'custom')),
  preset_key TEXT, -- e.g., 'gaming-minimal', 'neon-glow'
  name TEXT, -- User-defined name for custom/AI frames
  
  -- Style parameters (stored as JSONB for flexibility)
  style_params JSONB NOT NULL DEFAULT '{
    "shape": "rounded",
    "strokeWidth": 2,
    "glowIntensity": 0,
    "shadowIntensity": 0.3,
    "nameplateEnabled": false,
    "micRingEnabled": false,
    "micRingSensitivity": 0.5,
    "colorTheme": "primary"
  }'::jsonb,
  
  -- Layout parameters
  layout_params JSONB NOT NULL DEFAULT '{
    "positionAnchor": "bottom-right",
    "offsetX": 24,
    "offsetY": 24,
    "sizeScale": 1.0,
    "safeAreaSnapEnabled": true
  }'::jsonb,
  
  -- Apply scope
  apply_scope TEXT NOT NULL DEFAULT 'sessionDefault' CHECK (apply_scope IN ('sessionDefault', 'clipOnly', 'reelOnly')),
  clip_id UUID, -- Optional: specific clip this applies to
  
  -- AI generation metadata (for AI-generated frames)
  ai_source TEXT CHECK (ai_source IN ('game', 'mood', 'playstyle', 'custom')),
  ai_inputs JSONB DEFAULT '{}'::jsonb, -- { gameName?, mood?, playstyle? }
  ai_prompt_used TEXT, -- Internal: actual prompt sent to AI
  ai_variant_index INTEGER DEFAULT 0,
  generation_model TEXT,
  
  -- Asset references (for custom/AI frames with uploaded assets)
  asset_url TEXT,
  thumbnail_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add signature frame reference to capture_sessions
ALTER TABLE public.capture_sessions 
ADD COLUMN IF NOT EXISTS signature_frame_id UUID REFERENCES public.frame_overlays(id) ON DELETE SET NULL;

-- Add default frame flag to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS default_frame_id UUID REFERENCES public.frame_overlays(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.frame_overlays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for frame_overlays
CREATE POLICY "Users can create own frame overlays"
ON public.frame_overlays FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own frame overlays"
ON public.frame_overlays FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared session frame overlays"
ON public.frame_overlays FOR SELECT
USING (
  session_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM session_shares
    WHERE session_shares.session_id = frame_overlays.session_id
    AND (session_shares.shared_with = auth.uid() OR session_shares.share_token IS NOT NULL)
  )
);

CREATE POLICY "Users can update own frame overlays"
ON public.frame_overlays FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own frame overlays"
ON public.frame_overlays FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_frame_overlays_user_id ON public.frame_overlays(user_id);
CREATE INDEX idx_frame_overlays_session_id ON public.frame_overlays(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_frame_overlays_type ON public.frame_overlays(type);

-- Trigger for updated_at
CREATE TRIGGER update_frame_overlays_updated_at
BEFORE UPDATE ON public.frame_overlays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE public.frame_overlays IS 'Frame overlay metadata for camera frames. Applied during export/post-processing, not during live capture.';
COMMENT ON COLUMN public.frame_overlays.style_params IS 'Shape, stroke, glow, shadow, nameplate, mic ring settings';
COMMENT ON COLUMN public.frame_overlays.layout_params IS 'Position, offset, size, safe area settings';
COMMENT ON COLUMN public.frame_overlays.apply_scope IS 'Where this frame applies: sessionDefault, clipOnly, or reelOnly';