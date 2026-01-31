-- Add provisioning_status column to connected_accounts table
-- Values: 'pending', 'completed', 'failed'
ALTER TABLE public.connected_accounts 
ADD COLUMN IF NOT EXISTS provisioning_status TEXT DEFAULT 'pending';