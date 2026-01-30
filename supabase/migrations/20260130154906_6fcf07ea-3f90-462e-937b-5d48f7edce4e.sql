-- Community Reactions Table: Timeline-anchored emoji reactions for community videos
CREATE TABLE public.community_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  timestamp_seconds DOUBLE PRECISION NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('👍', '😂', '🔥', '😮', '😬', '💀', '👀')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one reaction per user per second window per type
  UNIQUE(post_id, user_id, reaction_type, timestamp_seconds)
);

-- Create indexes for efficient querying
CREATE INDEX idx_community_reactions_post_id ON public.community_reactions(post_id);
CREATE INDEX idx_community_reactions_timestamp ON public.community_reactions(post_id, timestamp_seconds);
CREATE INDEX idx_community_reactions_user ON public.community_reactions(user_id);

-- Enable Row Level Security
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view reactions on public posts
CREATE POLICY "View reactions on public posts"
ON public.community_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE community_posts.id = community_reactions.post_id
    AND community_posts.visibility = 'public'
  )
);

-- View reactions on unlisted posts (by share token - handled via post access)
CREATE POLICY "View reactions on unlisted posts"
ON public.community_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE community_posts.id = community_reactions.post_id
    AND community_posts.visibility = 'unlisted'
  )
);

-- Authenticated users can create reactions
CREATE POLICY "Users can create reactions"
ON public.community_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE community_posts.id = community_reactions.post_id
    AND community_posts.visibility IN ('public', 'unlisted')
  )
);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
ON public.community_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Authors can view all reactions on their posts
CREATE POLICY "Authors see all reactions on own posts"
ON public.community_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts
    WHERE community_posts.id = community_reactions.post_id
    AND community_posts.author_id = auth.uid()
  )
);