
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'landing',
  referral_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (no auth required for waitlist)
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT WITH CHECK (true);

-- Only admins can view waitlist
CREATE POLICY "Admins can view waitlist" ON public.waitlist
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
