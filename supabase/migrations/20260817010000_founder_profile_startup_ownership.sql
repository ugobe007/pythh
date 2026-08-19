-- Persist the startup selected during founder signup across browsers and devices.
ALTER TABLE public.pythh_founder_profiles
  ADD COLUMN IF NOT EXISTS startup_id UUID
  REFERENCES public.startup_uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pythh_founder_profiles_startup_id
  ON public.pythh_founder_profiles(startup_id);
