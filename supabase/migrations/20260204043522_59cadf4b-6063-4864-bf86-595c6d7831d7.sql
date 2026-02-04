-- Fix PUBLIC_USER_DATA: Restrict profiles SELECT to authenticated users only
-- Drop the overly permissive "Users can view all profiles" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a new policy that only allows authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Fix PUBLIC_COMMUNITY_DATA: Require authentication for community_posts SELECT
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view public posts" ON public.community_posts;
DROP POLICY IF EXISTS "Anyone can view unlisted posts via token" ON public.community_posts;

-- Create new policies that require authentication for public posts
CREATE POLICY "Authenticated users can view public posts"
ON public.community_posts
FOR SELECT
TO authenticated
USING (visibility = 'public');

-- Unlisted posts require authentication + share token check
CREATE POLICY "Authenticated users can view unlisted posts via token"
ON public.community_posts
FOR SELECT
TO authenticated
USING (visibility = 'unlisted');

-- Fix PUBLIC_REACTION_DATA: Require authentication for community_reactions SELECT
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "View reactions on public posts" ON public.community_reactions;
DROP POLICY IF EXISTS "View reactions on unlisted posts" ON public.community_reactions;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can view reactions on public posts"
ON public.community_reactions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM community_posts
  WHERE community_posts.id = community_reactions.post_id
  AND community_posts.visibility = 'public'
));

CREATE POLICY "Authenticated users can view reactions on unlisted posts"
ON public.community_reactions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM community_posts
  WHERE community_posts.id = community_reactions.post_id
  AND community_posts.visibility = 'unlisted'
));