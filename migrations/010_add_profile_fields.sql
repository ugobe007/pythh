-- Migration: Add display_name, role, and preferences columns to profiles
-- For user profile/account page

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder' 
  CHECK (role IN ('founder', 'investor', 'operator', 'other'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

COMMENT ON COLUMN profiles.display_name IS 'User display name (editable from profile page)';
COMMENT ON COLUMN profiles.role IS 'User role: founder, investor, operator, other';
COMMENT ON COLUMN profiles.preferences IS 'User preferences and settings (JSONB)';
