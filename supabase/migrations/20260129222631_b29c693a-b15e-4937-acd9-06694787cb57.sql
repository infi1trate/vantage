-- Add privacy and visibility columns to capture_sessions
ALTER TABLE public.capture_sessions 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create video_assets table for storing video file metadata
CREATE TABLE public.video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Asset details
  asset_type TEXT DEFAULT 'gameplay' CHECK (asset_type IN ('gameplay', 'facecam', 'combined', 'clip')),
  storage_url TEXT NOT NULL,
  storage_path TEXT,
  
  -- Video metadata
  duration_ms INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  framerate FLOAT,
  bitrate INTEGER,
  codec TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'video/webm',
  
  -- Processing state
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  processing_progress INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Thumbnails
  thumbnail_url TEXT,
  thumbnail_sprite_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create audio_tracks table for separate audio streams
CREATE TABLE public.audio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_asset_id UUID REFERENCES public.video_assets(id) ON DELETE SET NULL,
  
  -- Track details
  track_type TEXT DEFAULT 'game' CHECK (track_type IN ('game', 'voice_chat', 'microphone', 'desktop', 'mixed', 'voiceover')),
  track_name TEXT,
  storage_url TEXT NOT NULL,
  storage_path TEXT,
  
  -- Audio metadata
  duration_ms INTEGER NOT NULL DEFAULT 0,
  sample_rate INTEGER DEFAULT 48000,
  channels INTEGER DEFAULT 2,
  bitrate INTEGER,
  codec TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'audio/webm',
  
  -- Track settings
  volume_level FLOAT DEFAULT 1.0,
  is_muted BOOLEAN DEFAULT false,
  offset_ms INTEGER DEFAULT 0,
  
  -- Processing
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  waveform_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create facecam_tracks table for webcam overlays
CREATE TABLE public.facecam_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_asset_id UUID REFERENCES public.video_assets(id) ON DELETE SET NULL,
  
  -- Track details
  storage_url TEXT NOT NULL,
  storage_path TEXT,
  
  -- Video metadata
  duration_ms INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  framerate FLOAT,
  file_size_bytes BIGINT,
  
  -- Overlay positioning
  position_x FLOAT DEFAULT 0.8,
  position_y FLOAT DEFAULT 0.8,
  scale FLOAT DEFAULT 0.25,
  border_radius INTEGER DEFAULT 8,
  is_visible BOOLEAN DEFAULT true,
  opacity FLOAT DEFAULT 1.0,
  
  -- Sync
  offset_ms INTEGER DEFAULT 0,
  
  -- Processing
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create timeline_events table for auto-detected game events
CREATE TABLE public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'kill', 'death', 'assist', 'headshot', 'multikill', 
    'ace', 'clutch', 'round_start', 'round_end', 'round_win', 'round_loss',
    'plant', 'defuse', 'objective_capture', 'ultimate_used',
    'damage_dealt', 'damage_taken', 'healing',
    'match_start', 'match_end', 'half_time',
    'custom'
  )),
  event_subtype TEXT,
  
  -- Timing
  timestamp_ms INTEGER NOT NULL,
  duration_ms INTEGER,
  
  -- Event data
  title TEXT,
  description TEXT,
  value INTEGER,
  metadata JSONB DEFAULT '{}',
  
  -- Detection source
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_detected', 'game_api', 'ocr', 'audio_analysis')),
  confidence FLOAT,
  
  -- Display
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  color TEXT,
  icon TEXT,
  is_bookmarked BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create draw_annotations table for visual annotations (shapes, drawings)
CREATE TABLE public.draw_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE SET NULL,
  
  -- Timing
  timestamp_ms INTEGER NOT NULL,
  duration_ms INTEGER DEFAULT 3000,
  
  -- Drawing type and data
  draw_type TEXT NOT NULL CHECK (draw_type IN (
    'arrow', 'circle', 'rectangle', 'line', 'freehand', 
    'text', 'spotlight', 'blur', 'zoom'
  )),
  
  -- Position and size (normalized 0-1)
  start_x FLOAT NOT NULL,
  start_y FLOAT NOT NULL,
  end_x FLOAT,
  end_y FLOAT,
  width FLOAT,
  height FLOAT,
  
  -- For freehand drawings
  path_data JSONB,
  
  -- Styling
  stroke_color TEXT DEFAULT '#00E5FF',
  stroke_width FLOAT DEFAULT 3,
  fill_color TEXT,
  opacity FLOAT DEFAULT 1.0,
  
  -- Text content (for text annotations)
  text_content TEXT,
  font_size INTEGER DEFAULT 16,
  font_family TEXT DEFAULT 'Inter',
  
  -- Animation
  animation TEXT DEFAULT 'fade' CHECK (animation IN ('none', 'fade', 'draw', 'pop', 'slide')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add more fields to annotations table
ALTER TABLE public.annotations
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'owner' CHECK (visibility IN ('owner', 'shared', 'public')),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add more fields to voice_notes table
ALTER TABLE public.voice_notes
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waveform_data JSONB,
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Enhance ai_analyses table
ALTER TABLE public.ai_analyses
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS model_version TEXT,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS raw_output JSONB,
ADD COLUMN IF NOT EXISTS frame_references JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS confidence_scores JSONB DEFAULT '{}';

-- Rename review_comments to social_comments for clarity and add features
ALTER TABLE public.review_comments RENAME TO social_comments;

-- Add fields to social_comments
ALTER TABLE public.social_comments
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mentioned_users UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Create comment_reactions table
CREATE TABLE public.comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'helpful', 'agree', 'disagree', 'fire', 'thinking')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id, reaction_type)
);

-- Create user_preferences table
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Recording defaults
  default_game TEXT,
  record_facecam BOOLEAN DEFAULT true,
  record_microphone BOOLEAN DEFAULT true,
  record_game_audio BOOLEAN DEFAULT true,
  
  -- Playback preferences
  default_playback_speed FLOAT DEFAULT 1.0,
  auto_skip_dead_time BOOLEAN DEFAULT false,
  show_ai_insights BOOLEAN DEFAULT true,
  
  -- Privacy defaults
  default_session_visibility TEXT DEFAULT 'private',
  allow_ai_analysis BOOLEAN DEFAULT true,
  
  -- Notification settings
  notify_on_share BOOLEAN DEFAULT true,
  notify_on_comment BOOLEAN DEFAULT true,
  notify_on_analysis_complete BOOLEAN DEFAULT true,
  
  -- UI preferences
  theme TEXT DEFAULT 'dark',
  sidebar_collapsed BOOLEAN DEFAULT false,
  timeline_zoom FLOAT DEFAULT 1.0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facecam_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_assets
CREATE POLICY "Users can view own video assets" ON public.video_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view shared video assets" ON public.video_assets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = video_assets.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create own video assets" ON public.video_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own video assets" ON public.video_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own video assets" ON public.video_assets FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for audio_tracks
CREATE POLICY "Users can view own audio tracks" ON public.audio_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view shared audio tracks" ON public.audio_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = audio_tracks.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create own audio tracks" ON public.audio_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audio tracks" ON public.audio_tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own audio tracks" ON public.audio_tracks FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for facecam_tracks
CREATE POLICY "Users can view own facecam tracks" ON public.facecam_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view shared facecam tracks" ON public.facecam_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = facecam_tracks.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create own facecam tracks" ON public.facecam_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own facecam tracks" ON public.facecam_tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own facecam tracks" ON public.facecam_tracks FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for timeline_events
CREATE POLICY "Users can view own timeline events" ON public.timeline_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view shared timeline events" ON public.timeline_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = timeline_events.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create own timeline events" ON public.timeline_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own timeline events" ON public.timeline_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own timeline events" ON public.timeline_events FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for draw_annotations
CREATE POLICY "Users can view own draw annotations" ON public.draw_annotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view shared draw annotations" ON public.draw_annotations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = draw_annotations.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create own draw annotations" ON public.draw_annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own draw annotations" ON public.draw_annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own draw annotations" ON public.draw_annotations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comment_reactions
CREATE POLICY "Users can view all reactions" ON public.comment_reactions FOR SELECT USING (true);
CREATE POLICY "Users can create own reactions" ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_video_assets_updated_at BEFORE UPDATE ON public.video_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_audio_tracks_updated_at BEFORE UPDATE ON public.audio_tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_facecam_tracks_updated_at BEFORE UPDATE ON public.facecam_tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_draw_annotations_updated_at BEFORE UPDATE ON public.draw_annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_assets_session ON public.video_assets(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_session ON public.audio_tracks(session_id);
CREATE INDEX IF NOT EXISTS idx_facecam_tracks_session ON public.facecam_tracks(session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_session ON public.timeline_events(session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_timestamp ON public.timeline_events(timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_draw_annotations_session ON public.draw_annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_draw_annotations_timestamp ON public.draw_annotations(timestamp_ms);

-- Create storage bucket for video assets
INSERT INTO storage.buckets (id, name, public) VALUES ('video-assets', 'video-assets', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-tracks', 'audio-tracks', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('facecam-tracks', 'facecam-tracks', false) ON CONFLICT DO NOTHING;

-- Storage policies for video-assets (private bucket)
CREATE POLICY "Users can upload own videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'video-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own videos" ON storage.objects FOR SELECT USING (bucket_id = 'video-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own videos" ON storage.objects FOR DELETE USING (bucket_id = 'video-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for audio-tracks
CREATE POLICY "Users can upload own audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own audio" ON storage.objects FOR DELETE USING (bucket_id = 'audio-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for facecam-tracks
CREATE POLICY "Users can upload own facecam" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'facecam-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own facecam" ON storage.objects FOR SELECT USING (bucket_id = 'facecam-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own facecam" ON storage.objects FOR DELETE USING (bucket_id = 'facecam-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);