-- Create community_posts table
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  allow_comments BOOLEAN NOT NULL DEFAULT true,
  allow_public_annotations BOOLEAN NOT NULL DEFAULT false,
  allow_public_remixes BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  video_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for feed queries
CREATE INDEX idx_community_posts_visibility ON public.community_posts(visibility, created_at DESC);
CREATE INDEX idx_community_posts_author ON public.community_posts(author_id);
CREATE INDEX idx_community_posts_share_token ON public.community_posts(share_token);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view public posts
CREATE POLICY "Anyone can view public posts"
ON public.community_posts
FOR SELECT
USING (visibility = 'public');

-- Policy: Anyone can view unlisted posts with share token (handled in app via share_token lookup)
CREATE POLICY "Anyone can view unlisted posts via token"
ON public.community_posts
FOR SELECT
USING (visibility = 'unlisted');

-- Policy: Authors can view their own posts (including private)
CREATE POLICY "Authors can view own posts"
ON public.community_posts
FOR SELECT
USING (auth.uid() = author_id);

-- Policy: Only authors can create posts for their sessions
CREATE POLICY "Authors can create posts"
ON public.community_posts
FOR INSERT
WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (
    SELECT 1 FROM public.capture_sessions
    WHERE id = session_id AND user_id = auth.uid()
  )
);

-- Policy: Authors can update their own posts
CREATE POLICY "Authors can update own posts"
ON public.community_posts
FOR UPDATE
USING (auth.uid() = author_id);

-- Policy: Authors can delete their own posts
CREATE POLICY "Authors can delete own posts"
ON public.community_posts
FOR DELETE
USING (auth.uid() = author_id);

-- Add trigger for updated_at
CREATE TRIGGER update_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create community_annotations table for public annotations on community posts
CREATE TABLE public.community_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  timestamp_seconds DOUBLE PRECISION NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_annotations_post ON public.community_annotations(post_id, timestamp_seconds);

-- Enable RLS
ALTER TABLE public.community_annotations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view annotations on posts that allow public annotations
CREATE POLICY "View annotations on public annotation posts"
ON public.community_annotations
FOR SELECT
USING (
  NOT is_hidden AND
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE id = post_id AND allow_public_annotations = true
  )
);

-- Policy: Authors always see all annotations on their posts (including hidden, for moderation)
CREATE POLICY "Authors see all annotations on own posts"
ON public.community_annotations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE id = post_id AND author_id = auth.uid()
  )
);

-- Policy: Users can see their own annotations
CREATE POLICY "Users see own annotations"
ON public.community_annotations
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create annotations on posts that allow it
CREATE POLICY "Users can create annotations on allowed posts"
ON public.community_annotations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE id = post_id AND (allow_public_annotations = true OR author_id = auth.uid())
  )
);

-- Policy: Users can update own annotations
CREATE POLICY "Users can update own annotations"
ON public.community_annotations
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete own annotations OR post authors can delete any
CREATE POLICY "Users or post authors can delete annotations"
ON public.community_annotations
FOR DELETE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE id = post_id AND author_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_community_annotations_updated_at
BEFORE UPDATE ON public.community_annotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update social_comments to also work with community posts
-- Add a post_id column for comments on community posts
ALTER TABLE public.social_comments 
ADD COLUMN post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE;

-- Add policy for community post comments
CREATE POLICY "View comments on posts allowing comments"
ON public.social_comments
FOR SELECT
USING (
  post_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE id = post_id AND allow_comments = true
  )
);

-- Add policy for creating comments on community posts
CREATE POLICY "Create comments on posts allowing comments"
ON public.social_comments
FOR INSERT
WITH CHECK (
  (post_id IS NOT NULL AND auth.uid() = user_id AND
   EXISTS (
     SELECT 1 FROM public.community_posts
     WHERE id = post_id AND allow_comments = true
   ))
  OR
  (post_id IS NULL)
);