-- Add unique constraint on blocked_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'blocked_users_user_blocked_unique'
  ) THEN
    ALTER TABLE public.blocked_users 
    ADD CONSTRAINT blocked_users_user_blocked_unique 
    UNIQUE (user_id, blocked_user_id);
  END IF;
END $$;

-- Add unique constraint on connected_accounts (user_id, provider) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'connected_accounts_user_provider_unique'
  ) THEN
    ALTER TABLE public.connected_accounts 
    ADD CONSTRAINT connected_accounts_user_provider_unique 
    UNIQUE (user_id, provider);
  END IF;
END $$;

-- Add display_handle column to connected_accounts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'connected_accounts' 
    AND column_name = 'display_handle'
  ) THEN
    ALTER TABLE public.connected_accounts 
    ADD COLUMN display_handle text;
  END IF;
END $$;

-- Add location_text column to user_sessions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_sessions' 
    AND column_name = 'location_text'
  ) THEN
    ALTER TABLE public.user_sessions 
    ADD COLUMN location_text text;
  END IF;
END $$;