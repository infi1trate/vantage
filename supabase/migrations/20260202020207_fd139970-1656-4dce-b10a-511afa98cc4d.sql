-- Enable realtime for the reels table to support status change subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.reels;