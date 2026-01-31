-- Add camera default settings to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS camera_device_id text,
ADD COLUMN IF NOT EXISTS camera_mirror boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS camera_resolution text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS camera_fps text DEFAULT 'auto';