-- ============================================================================
-- K-ANONYMITY DRIFT MONITOR
-- ============================================================================
-- Daily check for rare bucket combinations that could become identifying
-- Run this every day to catch small sample sizes before they leak
-- ============================================================================

CREATE OR REPLACE FUNCTION check_k_anonymity_drift()
RETURNS TABLE (
  week_bucket date,
  geo text,
  sector text,
  stage text,
  k_value bigint,
  alert_level text,
  action_required text
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_buckets AS (
    SELECT 
      DATE_TRUNC('week', created_at)::date as week,
      COALESCE(geography, 'unspecified') as geo_bucket,
      industry as sector_bucket,
      stage as stage_bucket,
      COUNT(DISTINCT startup_id) as startup_count
    FROM investor_discovery_flow
    WHERE created_at >= NOW() - INTERVAL '30 days'  -- Last 4 weeks
    GROUP BY 
      DATE_TRUNC('week', created_at), 
      COALESCE(geography, 'unspecified'),
      industry,
      stage
  )
  SELECT 
    week::date,
    geo_bucket::text,
    sector_bucket::text,
    stage_bucket::text,
    startup_count::bigint as k_value,
    CASE 
      WHEN startup_count = 1 THEN 'CRITICAL'
      WHEN startup_count <= 3 THEN 'HIGH'
      WHEN startup_count <= 5 THEN 'MEDIUM'
      ELSE 'OK'
    END::text as alert_level,
    CASE 
      WHEN startup_count = 1 THEN 'Collapse geo OR sector on read (hide this slice)'
      WHEN startup_count <= 3 THEN 'Add timing fuzz or widen buckets before showing'
      WHEN startup_count <= 5 THEN 'Monitor - may need widening if investor queries repeatedly'
      ELSE 'Safe to show'
    END::text as action_required
  FROM weekly_buckets
  WHERE startup_count <= 5
  ORDER BY startup_count ASC, week DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_k_anonymity_drift() TO service_role;

COMMENT ON FUNCTION check_k_anonymity_drift() IS
'Detects k-anonymity drift over time. Even coarse buckets can become identifying 
when sample sizes are tiny (e.g., niche geo+sector+stage where only 1 appears that week).
Run daily. If k<5, collapse geo or sector on read, or hide that slice entirely.';

-- ============================================================================
-- Usage Example
-- ============================================================================
-- Run daily via cron:
-- SELECT * FROM check_k_anonymity_drift();
--
-- Sample output:
-- week_bucket | geo            | sector  | stage       | k_value | alert_level | action_required
-- 2026-01-13  | north_america  | ai_ml   | pre-seed    | 2       | HIGH        | Add timing fuzz...
-- 2026-01-13  | europe         | fintech | series_a    | 4       | MEDIUM      | Monitor...
--
-- If you see CRITICAL (k=1), immediately:
--   1. Stop showing that week's data for that combo
--   2. Widen geo bucket (drop geo entirely, show as "unspecified")
--   3. OR widen sector (merge into parent category)
-- ============================================================================
