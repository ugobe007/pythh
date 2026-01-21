-- ============================================================================
-- K-ANONYMITY HEALTH CHECK
-- ============================================================================
-- Run this query weekly to detect re-identification risks
-- Flags bucket combinations where k < 5 (high risk)
-- ============================================================================

-- Check k-values for current discovery flow
WITH bucket_combos AS (
  SELECT 
    stage,
    industry,
    COALESCE(geography, 'unspecified') as geo,
    alignment_state,
    COUNT(DISTINCT startup_id) as k_value,
    COUNT(*) as row_count,
    ARRAY_AGG(DISTINCT investor_id) as investors_who_see_this
  FROM investor_discovery_flow
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY stage, industry, COALESCE(geography, 'unspecified'), alignment_state
)
SELECT 
  stage,
  industry,
  geo,
  alignment_state,
  k_value,
  row_count,
  array_length(investors_who_see_this, 1) as investor_count,
  CASE 
    WHEN k_value = 1 THEN '🚨 CRITICAL - Unique identifier (DO NOT SHOW)'
    WHEN k_value <= 3 THEN '⚠️ HIGH RISK - Suppress or widen buckets'
    WHEN k_value <= 5 THEN '⚠️ MEDIUM RISK - Monitor closely'
    WHEN k_value <= 10 THEN '✅ OK - Monitor'
    ELSE '✅ SAFE'
  END as risk_level
FROM bucket_combos
ORDER BY k_value ASC, row_count DESC;

-- Recommended actions by risk level:
-- 
-- 🚨 CRITICAL (k=1): 
--   - DELETE these rows immediately
--   - Widen stage bucket (Pre-seed → Early-stage)
--   - Widen industry bucket (AI/ML → Tech)
--   - Drop geography if it makes combo unique
--
-- ⚠️ HIGH RISK (k=2-3):
--   - Add timing fuzz (show "this week" not exact date)
--   - Combine with adjacent buckets
--   - Monitor for 48h before showing
--
-- ⚠️ MEDIUM RISK (k=4-5):
--   - Flag for review if investor queries repeatedly
--   - Add to watchlist for scraping behavior
--
-- ✅ OK (k=6-10):
--   - Safe to show
--   - Continue monitoring weekly
--
-- ✅ SAFE (k>10):
--   - No action needed
