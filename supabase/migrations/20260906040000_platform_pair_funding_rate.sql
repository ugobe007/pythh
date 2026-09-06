-- Homepage hero: pair-layer funding rate (sealed + live Hit@5).
ALTER TABLE public.platform_stats_cache
  ADD COLUMN IF NOT EXISTS pair_funding_rate_pct numeric,
  ADD COLUMN IF NOT EXISTS pair_funding_hits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pair_funding_startups integer NOT NULL DEFAULT 0;

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
        'funded_startups', c.funded_startups,
        'pair_funding_rate_pct', c.pair_funding_rate_pct,
        'pair_funding_hits', c.pair_funding_hits,
        'pair_funding_startups', c.pair_funding_startups,
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
      'funded_startups', 0,
      'pair_funding_rate_pct', NULL,
      'pair_funding_hits', 0,
      'pair_funding_startups', 0,
      'computed_at', NOW(),
      'source', 'empty'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role;

COMMENT ON COLUMN public.platform_stats_cache.pair_funding_rate_pct IS
  'Share of startups with a verified post-prediction funder whose funder sat in sealed or live top-5.';
