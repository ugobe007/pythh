-- ============================================================================
-- SAFETY ALARMS - Automated Monitoring Queries
-- ============================================================================
-- Run these queries on schedule to detect security/quality issues
-- Set up as cron jobs or PM2 processes
-- ============================================================================

-- ============================================================================
-- ALARM 1: K-Anonymity Risk Monitor (Run: Every Monday morning)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_k_anonymity_risks()
RETURNS TABLE (
  alert_level text,
  combo_details text,
  k_value bigint,
  action_required text
) AS $$
BEGIN
  RETURN QUERY
  WITH bucket_combos AS (
    SELECT 
      stage || '|' || industry || '|' || COALESCE(geography, 'null') as combo,
      COUNT(DISTINCT startup_id) as startup_count,
      COUNT(DISTINCT investor_id) as investor_count
    FROM investor_discovery_flow
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY combo
  )
  SELECT 
    CASE 
      WHEN startup_count = 1 THEN 'CRITICAL'
      WHEN startup_count <= 3 THEN 'HIGH'
      WHEN startup_count <= 5 THEN 'MEDIUM'
      ELSE 'OK'
    END::text as alert_level,
    combo::text as combo_details,
    startup_count as k_value,
    CASE 
      WHEN startup_count = 1 THEN 'DELETE row immediately, widen buckets'
      WHEN startup_count <= 3 THEN 'Add timing fuzz or widen buckets'
      WHEN startup_count <= 5 THEN 'Monitor for 48h, flag if queried repeatedly'
      ELSE 'No action needed'
    END::text as action_required
  FROM bucket_combos
  WHERE startup_count <= 5
  ORDER BY startup_count ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ALARM 2: Scraping Behavior Detector (Run: Every hour)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_scraping_behavior()
RETURNS TABLE (
  investor_name text,
  session_count_24h bigint,
  total_items_viewed bigint,
  avg_duration_minutes numeric,
  alert_level text,
  action_required text
) AS $$
BEGIN
  RETURN QUERY
  WITH session_behavior AS (
    SELECT 
      s.investor_id,
      COUNT(*) as session_count,
      SUM(s.items_viewed) as items_viewed,
      AVG(s.duration_minutes) as avg_duration
    FROM investor_observatory_sessions s
    WHERE s.session_start >= NOW() - INTERVAL '24 hours'
    GROUP BY s.investor_id
  )
  SELECT 
    i.name::text,
    sb.session_count::bigint,
    sb.items_viewed::bigint,
    ROUND(sb.avg_duration::numeric, 2) as avg_duration_minutes,
    CASE 
      WHEN sb.session_count > 50 THEN 'CRITICAL'
      WHEN sb.items_viewed > 200 THEN 'HIGH'
      WHEN sb.avg_duration < 1 AND sb.session_count > 20 THEN 'HIGH'
      ELSE 'MEDIUM'
    END::text as alert_level,
    CASE 
      WHEN sb.session_count > 50 THEN 'Rate-limit to 10 req/min, email admin'
      WHEN sb.items_viewed > 200 THEN 'Flip kill switch, investigate'
      WHEN sb.avg_duration < 1 AND sb.session_count > 20 THEN 'Likely bot, disable account'
      ELSE 'Monitor for 24h'
    END::text as action_required
  FROM session_behavior sb
  JOIN investors i ON i.id = sb.investor_id
  WHERE sb.session_count > 20 OR sb.items_viewed > 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ALARM 3: Quality Drift Detector (Run: Daily)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_quality_drift()
RETURNS TABLE (
  investor_name text,
  current_week date,
  not_relevant_pct numeric,
  prev_week_pct numeric,
  pct_change numeric,
  alert_level text,
  action_required text
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_feedback AS (
    SELECT 
      DATE_TRUNC('week', created_at)::date as week,
      investor_id,
      COUNT(*) as total_feedback,
      SUM(CASE WHEN feedback_type = 'not_relevant' THEN 1 ELSE 0 END) as not_relevant_count,
      ROUND(100.0 * SUM(CASE WHEN feedback_type = 'not_relevant' THEN 1 ELSE 0 END) / COUNT(*), 1) as not_relevant_percentage
    FROM investor_inbound_feedback
    GROUP BY 1, 2
  ),
  with_lag AS (
    SELECT 
      w.investor_id,
      w.week,
      w.not_relevant_percentage,
      LAG(w.not_relevant_percentage) OVER (PARTITION BY w.investor_id ORDER BY w.week) as prev_pct
    FROM weekly_feedback w
  )
  SELECT 
    i.name::text,
    wl.week::date,
    wl.not_relevant_percentage::numeric,
    COALESCE(wl.prev_pct, 0)::numeric,
    (wl.not_relevant_percentage - COALESCE(wl.prev_pct, 0))::numeric as pct_change,
    CASE 
      WHEN wl.not_relevant_percentage > 60 THEN 'CRITICAL'
      WHEN wl.not_relevant_percentage - COALESCE(wl.prev_pct, 0) > 20 THEN 'HIGH'
      WHEN wl.not_relevant_percentage > 40 THEN 'MEDIUM'
      ELSE 'OK'
    END::text as alert_level,
    CASE 
      WHEN wl.not_relevant_percentage > 60 THEN 'Pause inbound pipeline, review scrapers'
      WHEN wl.not_relevant_percentage - COALESCE(wl.prev_pct, 0) > 20 THEN 'Check if new RSS source is low quality'
      WHEN wl.not_relevant_percentage > 40 THEN 'Investor criteria may have changed, reach out'
      ELSE 'No action needed'
    END::text as action_required
  FROM with_lag wl
  JOIN investors i ON i.id = wl.investor_id
  WHERE wl.not_relevant_percentage > 40
  ORDER BY wl.week DESC, wl.not_relevant_percentage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ALARM 4: Sample Size Drop Detector (Run: Daily)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_sample_size_drops()
RETURNS TABLE (
  bucket_type text,
  bucket_value text,
  unique_startups bigint,
  alert_level text,
  action_required text
) AS $$
BEGIN
  RETURN QUERY
  -- Check industry buckets
  SELECT 
    'industry'::text as bucket_type,
    industry::text as bucket_value,
    COUNT(DISTINCT startup_id)::bigint as unique_startups,
    CASE 
      WHEN COUNT(DISTINCT startup_id) < 5 THEN 'CRITICAL'
      WHEN COUNT(DISTINCT startup_id) < 10 THEN 'MEDIUM'
      ELSE 'OK'
    END::text as alert_level,
    CASE 
      WHEN COUNT(DISTINCT startup_id) < 5 THEN 'Widen bucket immediately'
      WHEN COUNT(DISTINCT startup_id) < 10 THEN 'Monitor for 48h'
      ELSE 'No action needed'
    END::text as action_required
  FROM investor_discovery_flow
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY industry
  HAVING COUNT(DISTINCT startup_id) < 10
  
  UNION ALL
  
  -- Check stage buckets
  SELECT 
    'stage'::text,
    stage::text,
    COUNT(DISTINCT startup_id)::bigint,
    CASE 
      WHEN COUNT(DISTINCT startup_id) < 5 THEN 'CRITICAL'
      WHEN COUNT(DISTINCT startup_id) < 10 THEN 'MEDIUM'
      ELSE 'OK'
    END::text,
    CASE 
      WHEN COUNT(DISTINCT startup_id) < 5 THEN 'Combine with adjacent stage'
      WHEN COUNT(DISTINCT startup_id) < 10 THEN 'Monitor for 48h'
      ELSE 'No action needed'
    END::text
  FROM investor_discovery_flow
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY stage
  HAVING COUNT(DISTINCT startup_id) < 10
  
  ORDER BY unique_startups ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant access to service_role only (these are admin functions)
-- ============================================================================
GRANT EXECUTE ON FUNCTION check_k_anonymity_risks() TO service_role;
GRANT EXECUTE ON FUNCTION check_scraping_behavior() TO service_role;
GRANT EXECUTE ON FUNCTION check_quality_drift() TO service_role;
GRANT EXECUTE ON FUNCTION check_sample_size_drops() TO service_role;

-- ============================================================================
-- Usage Examples
-- ============================================================================
-- Run in Supabase SQL Editor or via cron:
--
-- SELECT * FROM check_k_anonymity_risks();
-- SELECT * FROM check_scraping_behavior();
-- SELECT * FROM check_quality_drift();
-- SELECT * FROM check_sample_size_drops();
--
-- Or combine into a single health report:
--
-- SELECT 'K-Anonymity' as check_type, alert_level, combo_details as details, action_required
-- FROM check_k_anonymity_risks()
-- UNION ALL
-- SELECT 'Scraping', alert_level, investor_name, action_required
-- FROM check_scraping_behavior()
-- UNION ALL
-- SELECT 'Quality Drift', alert_level, investor_name || ' (week ' || current_week || ')', action_required
-- FROM check_quality_drift()
-- UNION ALL
-- SELECT 'Sample Size', alert_level, bucket_type || ': ' || bucket_value, action_required
-- FROM check_sample_size_drops()
-- ORDER BY alert_level DESC, check_type;
