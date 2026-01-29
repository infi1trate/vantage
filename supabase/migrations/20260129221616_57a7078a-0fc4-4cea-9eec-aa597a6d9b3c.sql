-- Fix function search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix overly permissive AI analyses policy - restrict to authenticated users creating analyses for their own sessions
DROP POLICY IF EXISTS "Anyone can insert analyses" ON public.ai_analyses;
CREATE POLICY "Users can insert analyses for own sessions" ON public.ai_analyses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.capture_sessions WHERE id = session_id AND user_id = auth.uid())
);