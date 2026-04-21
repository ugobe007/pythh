-- Fast admin dashboard aggregates (replaces full-table paginate over startup_uploads in Node)
-- Used by GET /api/admin/score-health and related checks.

CREATE OR REPLACE FUNCTION public.admin_get_score_health_core()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH approved AS (
    SELECT *
    FROM public.startup_uploads
    WHERE status = 'approved'
  ),
  comp AS (
    SELECT *
    FROM approved
    WHERE team_score IS NOT NULL
      AND traction_score IS NOT NULL
      AND market_score IS NOT NULL
      AND product_score IS NOT NULL
      AND vision_score IS NOT NULL
  ),
  tier_counts AS (
    SELECT COALESCE(extracted_data->>'data_tier', 'unknown') AS tier, COUNT(*)::bigint AS c
    FROM public.startup_uploads
    GROUP BY 1
  ),
  status_counts AS (
    SELECT status, COUNT(*)::bigint AS c
    FROM public.startup_uploads
    GROUP BY status
  )
  SELECT jsonb_build_object(
    'total_startups', (SELECT COUNT(*)::int FROM approved),
    'avg_score', (
      SELECT ROUND(AVG(total_god_score)::numeric, 4)
      FROM approved
      WHERE total_god_score IS NOT NULL
    ),
    'b40', (SELECT COUNT(*)::int FROM approved WHERE total_god_score >= 40 AND total_god_score < 50),
    'b50', (SELECT COUNT(*)::int FROM approved WHERE total_god_score >= 50 AND total_god_score < 60),
    'b60', (SELECT COUNT(*)::int FROM approved WHERE total_god_score >= 60 AND total_god_score < 70),
    'b70', (SELECT COUNT(*)::int FROM approved WHERE total_god_score >= 70 AND total_god_score < 80),
    'b80', (SELECT COUNT(*)::int FROM approved WHERE total_god_score >= 80 AND total_god_score <= 100),
    'comp_n', (SELECT COUNT(*)::int FROM comp),
    'comp_team', (SELECT ROUND(AVG(team_score)::numeric, 4) FROM comp),
    'comp_traction', (SELECT ROUND(AVG(traction_score)::numeric, 4) FROM comp),
    'comp_market', (SELECT ROUND(AVG(market_score)::numeric, 4) FROM comp),
    'comp_product', (SELECT ROUND(AVG(product_score)::numeric, 4) FROM comp),
    'comp_vision', (SELECT ROUND(AVG(vision_score)::numeric, 4) FROM comp),
    'enrich_total', (SELECT COUNT(*)::int FROM public.startup_uploads),
    'enrich_needs', (
      SELECT COUNT(*)::int
      FROM public.startup_uploads
      WHERE extracted_data IS NULL
         OR (extracted_data->>'data_tier') = 'C'
         OR (extracted_data->>'data_tier') IS NULL
         OR (extracted_data->>'data_tier') = ''
         OR (data_completeness IS NOT NULL AND data_completeness < 35)
    ),
    'tier_counts', COALESCE((SELECT jsonb_object_agg(tier, c) FROM tier_counts), '{}'::jsonb),
    'status_counts', COALESCE((SELECT jsonb_object_agg(status, c) FROM status_counts), '{}'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.admin_get_score_health_core IS
  'Single-query GOD distribution + component avgs + enrichment tier/status counts for admin score-health API.';

GRANT EXECUTE ON FUNCTION public.admin_get_score_health_core() TO service_role;

-- Social signals summary for admin (avoids 2× 10k row fetches from Node)
CREATE OR REPLACE FUNCTION public.admin_get_social_signal_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_signals', (SELECT COUNT(*)::bigint FROM public.social_signals),
    'platforms', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('platform', platform, 'count', c, 'uniqueStartups', u))
      FROM (
        SELECT
          platform,
          COUNT(*)::bigint AS c,
          COUNT(DISTINCT startup_id)::bigint AS u
        FROM public.social_signals
        GROUP BY platform
        ORDER BY c DESC
      ) x
    ), '[]'::jsonb),
    'unique_startups', (SELECT COUNT(DISTINCT startup_id)::bigint FROM public.social_signals WHERE startup_id IS NOT NULL),
    'top_startups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'signalCount', signal_count,
        'buzzScore', buzz
      ))
      FROM (
        SELECT
          COALESCE(NULLIF(TRIM(startup_name), ''), 'Unknown') AS name,
          COUNT(*)::bigint AS signal_count,
          ROUND(COALESCE(SUM(engagement_score), 0)::numeric, 0)::bigint AS buzz
        FROM public.social_signals
        GROUP BY COALESCE(NULLIF(TRIM(startup_name), ''), 'Unknown')
        ORDER BY signal_count DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'last_updated', (SELECT MAX(created_at) FROM public.social_signals)
  );
$$;

COMMENT ON FUNCTION public.admin_get_social_signal_dashboard IS
  'Aggregated social_signals for /api/admin/social-signals (counts + top names in SQL).';

GRANT EXECUTE ON FUNCTION public.admin_get_social_signal_dashboard() TO service_role;
