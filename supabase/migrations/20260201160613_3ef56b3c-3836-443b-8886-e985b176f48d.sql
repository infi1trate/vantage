-- Extension recordings table for tracking uploads from Chrome extension
CREATE TABLE public.extension_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Upload metadata
  mime_type TEXT NOT NULL DEFAULT 'video/webm',
  container TEXT NOT NULL DEFAULT 'webm',
  video_codec TEXT,
  audio_codec TEXT,
  has_mic BOOLEAN DEFAULT false,
  has_cam BOOLEAN DEFAULT false,
  capture_source TEXT,
  client TEXT DEFAULT 'chrome_extension',
  file_size_bytes BIGINT,
  
  -- Storage
  storage_path TEXT NOT NULL,
  upload_url_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_size_bytes BIGINT DEFAULT 5368709120, -- 5GB default
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_upload',
  uploaded_at TIMESTAMP WITH TIME ZONE,
  session_id UUID,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extension_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can create own recordings"
  ON public.extension_recordings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own recordings"
  ON public.extension_recordings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings"
  ON public.extension_recordings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings"
  ON public.extension_recordings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_extension_recordings_updated_at
  BEFORE UPDATE ON public.extension_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for user lookups
CREATE INDEX idx_extension_recordings_user_id ON public.extension_recordings(user_id);
CREATE INDEX idx_extension_recordings_status ON public.extension_recordings(status);