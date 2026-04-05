-- Fast, reliable platform totals for anon-facing RPC (avoids work_mem / complex aggregates).
-- SECURITY DEFINER reads through RLS consistently with count queries the app already uses.

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'startups', (
      SELECT COUNT(*)::bigint
      FROM public.startup_uploads
      WHERE status = 'approved'
    ),
    'investors', (SELECT COUNT(*)::bigint FROM public.investors),
    'matches', (SELECT COUNT(*)::bigint FROM public.startup_investor_matches)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_platform_stats IS
  'Marketing totals: approved startups, investors, match rows. Used by web app hero stats.';
