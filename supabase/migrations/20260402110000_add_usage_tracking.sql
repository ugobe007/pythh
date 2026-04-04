-- Server-side usage tracking for free-tier analysis limit
-- Prevents localStorage bypass (clearing localStorage resets local counter,
-- but the server counter persists across devices and sessions).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analysis_count INTEGER NOT NULL DEFAULT 0;

-- Atomic increment function used by /api/usage/increment
-- Creates the profile row if it doesn't exist yet (first-time users).
CREATE OR REPLACE FUNCTION public.increment_analysis_count(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, analysis_count)
  VALUES (user_id_param, 1)
  ON CONFLICT (id) DO UPDATE
    SET analysis_count = profiles.analysis_count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_analysis_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_analysis_count(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
