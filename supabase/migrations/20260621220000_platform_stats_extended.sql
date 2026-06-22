-- Cached platform stats for homepage counter (avoids COUNT(*) timeout on 3.7M+ matches).
-- Refreshed by scripts/refresh-platform-stats-cache.mjs, match-regenerator, weekly dashboard.

CREATE TABLE IF NOT EXISTS public.platform_stats_cache (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  startups bigint NOT NULL DEFAULT 0,
  startups_total bigint NOT NULL DEFAULT 0,
  investors bigint NOT NULL DEFAULT 0,
  matches bigint NOT NULL DEFAULT 0,
  matches_new_7d bigint NOT NULL DEFAULT 0,
  matches_new_30d bigint NOT NULL DEFAULT 0,
  signals bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  refresh_source text
);

ALTER TABLE public.platform_stats_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_stats_cache_public_read ON public.platform_stats_cache;
CREATE POLICY platform_stats_cache_public_read ON public.platform_stats_cache
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.platform_stats_cache TO anon, authenticated;
GRANT ALL ON public.platform_stats_cache TO service_role;

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT json_build_object(
        'startups', c.startups,
        'startups_total', c.startups_total,
        'investors', c.investors,
        'matches', c.matches,
        'matches_new_7d', c.matches_new_7d,
        'matches_new_30d', c.matches_new_30d,
        'signals', c.signals,
        'computed_at', c.updated_at,
        'source', COALESCE(c.refresh_source, 'cache')
      )
      FROM public.platform_stats_cache c
      WHERE c.id = 1 AND c.matches > 0
    ),
    json_build_object(
      'startups', 0,
      'startups_total', 0,
      'investors', 0,
      'matches', 0,
      'matches_new_7d', 0,
      'matches_new_30d', 0,
      'signals', 0,
      'computed_at', NOW(),
      'source', 'empty'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role;

COMMENT ON TABLE public.platform_stats_cache IS
  'Single-row cache of marketing totals. Refresh after match regen / weekly dashboard.';
COMMENT ON FUNCTION public.get_platform_stats IS
  'Returns cached platform stats for homepage counter (no full-table scan at request time).';
