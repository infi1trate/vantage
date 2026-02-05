-- Create app_role enum for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for admin access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create challenges table
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  game_name TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'judging', 'completed', 'cancelled')),
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  winner_announced_at TIMESTAMP WITH TIME ZONE,
  max_submissions_per_user INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  prize_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on challenges
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- RLS policies for challenges
CREATE POLICY "Anyone can view active challenges"
ON public.challenges
FOR SELECT
USING (status IN ('active', 'judging', 'completed'));

CREATE POLICY "Admins can view all challenges"
ON public.challenges
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create challenges"
ON public.challenges
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = created_by);

CREATE POLICY "Admins can update challenges"
ON public.challenges
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete challenges"
ON public.challenges
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create challenge_submissions table
CREATE TABLE public.challenge_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.capture_sessions(id) ON DELETE SET NULL,
  clip_start_ms INTEGER,
  clip_end_ms INTEGER,
  title TEXT,
  description TEXT,
  proof_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'winner')),
  rank INTEGER,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on submissions
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for submissions
CREATE POLICY "Users can view approved submissions"
ON public.challenge_submissions
FOR SELECT
USING (status IN ('approved', 'winner'));

CREATE POLICY "Users can view their own submissions"
ON public.challenge_submissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
ON public.challenge_submissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own submissions"
ON public.challenge_submissions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending submissions"
ON public.challenge_submissions
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can update any submission"
ON public.challenge_submissions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their pending submissions"
ON public.challenge_submissions
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can delete any submission"
ON public.challenge_submissions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add updated_at triggers
CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_challenge_submissions_updated_at
BEFORE UPDATE ON public.challenge_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_challenges_status ON public.challenges(status);
CREATE INDEX idx_challenges_ends_at ON public.challenges(ends_at);
CREATE INDEX idx_submissions_challenge_id ON public.challenge_submissions(challenge_id);
CREATE INDEX idx_submissions_user_id ON public.challenge_submissions(user_id);
CREATE INDEX idx_submissions_status ON public.challenge_submissions(status);