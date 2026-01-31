-- Add encrypted token storage columns to connected_accounts for Dropbox auto-sync
ALTER TABLE public.connected_accounts 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;