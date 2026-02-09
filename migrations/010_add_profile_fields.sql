-- Migration: Add display_name and role columns to profiles
-- For user profile/account page

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder';

COMMENT ON COLUMN profiles.display_name IS 'User display name (editable from profile page)';
COMMENT ON COLUMN profiles.role IS 'User role: founder, investor, operator, other';
