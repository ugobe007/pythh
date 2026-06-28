-- Optimize get_platform_velocity: single 7-day scan instead of six full-table counts.

CREATE OR REPLACE FUNCTION get_platform_velocity()
RETURNS TABLE (
  total_matches_today BIGINT,
  total_matches_week BIGINT,
  startups_discovered_today BIGINT,
  high_quality_matches_today BIGINT,
  avg_match_score_today NUMERIC,
  top_tier_activity_today BIGINT
)
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '45s'
AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      m.created_at,
      m.match_score,
      i.tier AS investor_tier
    FROM startup_investor_matches m
    LEFT JOIN investors i ON m.investor_id = i.id
    WHERE m.created_at >= CURRENT_DATE - INTERVAL '7 days'
  ),
  match_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::BIGINT AS today,
      COUNT(*)::BIGINT AS week,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND match_score >= 80)::BIGINT AS hq_today,
      ROUND(AVG(match_score) FILTER (WHERE created_at >= CURRENT_DATE), 1) AS avg_today,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND investor_tier = '1')::BIGINT AS tier1_today
    FROM recent
  ),
  disc AS (
    SELECT COUNT(*)::BIGINT AS today
    FROM discovered_startups
    WHERE discovered_at >= CURRENT_DATE
  )
  SELECT
    match_agg.today,
    match_agg.week,
    disc.today,
    match_agg.hq_today,
    match_agg.avg_today,
    match_agg.tier1_today
  FROM match_agg
  CROSS JOIN disc;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_platform_velocity IS
  'Live platform metrics for tickers — scans last 7 days of matches only (optimized).';
