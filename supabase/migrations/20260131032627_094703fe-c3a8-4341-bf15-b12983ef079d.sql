-- Table to track Dropbox sync status for sessions
CREATE TABLE public.dropbox_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  dropbox_path TEXT,
  dropbox_file_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  file_size_bytes BIGINT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_session_sync UNIQUE(session_id)
);

-- Enable RLS
ALTER TABLE public.dropbox_sync_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync status
CREATE POLICY "Users can view own sync status"
ON public.dropbox_sync_status
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own sync status
CREATE POLICY "Users can insert own sync status"
ON public.dropbox_sync_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sync status
CREATE POLICY "Users can update own sync status"
ON public.dropbox_sync_status
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own sync status
CREATE POLICY "Users can delete own sync status"
ON public.dropbox_sync_status
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_dropbox_sync_status_updated_at
BEFORE UPDATE ON public.dropbox_sync_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_dropbox_sync_user ON public.dropbox_sync_status(user_id);
CREATE INDEX idx_dropbox_sync_status ON public.dropbox_sync_status(sync_status);