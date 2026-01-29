-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create capture_sessions table for gameplay recordings
CREATE TABLE public.capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  game_name TEXT,
  duration_seconds INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'ready', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create annotations table for timeline markers
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_seconds FLOAT NOT NULL,
  end_timestamp_seconds FLOAT,
  annotation_type TEXT DEFAULT 'marker' CHECK (annotation_type IN ('marker', 'note', 'highlight', 'kill', 'death', 'objective')),
  title TEXT,
  content TEXT,
  color TEXT DEFAULT '#00E5FF',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create voice_notes table for voice annotations (first-class data)
CREATE TABLE public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE SET NULL,
  timestamp_seconds FLOAT NOT NULL,
  duration_seconds FLOAT NOT NULL,
  audio_url TEXT NOT NULL,
  transcription TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create ai_analyses table for AI-generated insights
CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  analysis_type TEXT DEFAULT 'general' CHECK (analysis_type IN ('general', 'aim', 'positioning', 'decision', 'economy')),
  summary TEXT,
  insights JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create session_shares table for sharing sessions with others
CREATE TABLE public.session_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'annotate', 'edit')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create review_comments table for collaborative review
CREATE TABLE public.review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.review_comments(id) ON DELETE CASCADE,
  timestamp_seconds FLOAT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Capture sessions policies
CREATE POLICY "Users can view own sessions" ON public.capture_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view shared sessions" ON public.capture_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = capture_sessions.id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create own sessions" ON public.capture_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.capture_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.capture_sessions FOR DELETE USING (auth.uid() = user_id);

-- Annotations policies
CREATE POLICY "Users can view annotations on accessible sessions" ON public.annotations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = annotations.session_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = annotations.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create annotations on own sessions" ON public.annotations FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create annotations on shared sessions with annotate permission" ON public.annotations FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = annotations.session_id AND shared_with = auth.uid() AND permission IN ('annotate', 'edit'))
);
CREATE POLICY "Users can update own annotations" ON public.annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own annotations" ON public.annotations FOR DELETE USING (auth.uid() = user_id);

-- Voice notes policies
CREATE POLICY "Users can view voice notes on accessible sessions" ON public.voice_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = voice_notes.session_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = voice_notes.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create voice notes" ON public.voice_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own voice notes" ON public.voice_notes FOR DELETE USING (auth.uid() = user_id);

-- AI analyses policies
CREATE POLICY "Users can view analyses on own sessions" ON public.ai_analyses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = ai_analyses.session_id AND user_id = auth.uid())
);
CREATE POLICY "Anyone can insert analyses" ON public.ai_analyses FOR INSERT WITH CHECK (true);

-- Session shares policies
CREATE POLICY "Users can view shares they created or received" ON public.session_shares FOR SELECT USING (shared_by = auth.uid() OR shared_with = auth.uid());
CREATE POLICY "Users can create shares for own sessions" ON public.session_shares FOR INSERT WITH CHECK (
  auth.uid() = shared_by AND EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own shares" ON public.session_shares FOR DELETE USING (shared_by = auth.uid());

-- Review comments policies
CREATE POLICY "Users can view comments on accessible sessions" ON public.review_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = review_comments.session_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.session_shares WHERE session_id = review_comments.session_id AND (shared_with = auth.uid() OR share_token IS NOT NULL))
);
CREATE POLICY "Users can create comments" ON public.review_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.review_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.review_comments FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_capture_sessions_updated_at BEFORE UPDATE ON public.capture_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_review_comments_updated_at BEFORE UPDATE ON public.review_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-notes', 'voice-notes', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('session-thumbnails', 'session-thumbnails', true);

-- Storage policies
CREATE POLICY "Users can upload voice notes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Voice notes are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'voice-notes');
CREATE POLICY "Users can delete own voice notes" ON storage.objects FOR DELETE USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'session-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Thumbnails are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'session-thumbnails');
CREATE POLICY "Users can delete own thumbnails" ON storage.objects FOR DELETE USING (bucket_id = 'session-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);