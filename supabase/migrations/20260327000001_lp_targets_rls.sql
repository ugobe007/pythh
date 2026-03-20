-- P5: RLS for lp_targets and lp_sources (admin-only)

ALTER TABLE public.lp_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_sources ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (profiles.is_admin)
CREATE POLICY "Admins full access lp_targets"
  ON public.lp_targets FOR ALL
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Admins full access lp_sources"
  ON public.lp_sources FOR ALL
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Service role (migrations, scripts) always has full access
CREATE POLICY "Service role lp_targets"
  ON public.lp_targets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role lp_sources"
  ON public.lp_sources FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow anon/authenticated to read lp_sources (reference data, no sensitive info)
CREATE POLICY "Anyone read lp_sources"
  ON public.lp_sources FOR SELECT
  USING (true);
