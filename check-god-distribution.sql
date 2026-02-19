-- ============================================================================
-- Check GOD Score Distribution After Recalibration
-- ============================================================================

SELECT 
  COUNT(*) as total_startups,
  ROUND(AVG(total_god_score)::numeric, 1) as avg_score,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_god_score)::numeric, 1) as median_score,
  MIN(total_god_score) as min_score,
  MAX(total_god_score) as max_score,
  ROUND(STDDEV(total_god_score)::numeric, 1) as std_dev,
  COUNT(*) FILTER (WHERE total_god_score >= 80) as count_80_plus,
  COUNT(*) FILTER (WHERE total_god_score >= 70 AND total_god_score < 80) as count_70_79,
  COUNT(*) FILTER (WHERE total_god_score >= 60 AND total_god_score < 70) as count_60_69,
  COUNT(*) FILTER (WHERE total_god_score >= 50 AND total_god_score < 60) as count_50_59,
  COUNT(*) FILTER (WHERE total_god_score >= 40 AND total_god_score < 50) as count_40_49,
  COUNT(*) FILTER (WHERE total_god_score < 40) as count_below_40
FROM startup_uploads
WHERE status = 'approved';

-- Distribution by ranges
SELECT 
  CASE 
    WHEN total_god_score >= 80 THEN '80-100 (Elite)'
    WHEN total_god_score >= 70 THEN '70-79 (Excellent)'
    WHEN total_god_score >= 60 THEN '60-69 (Strong)'
    WHEN total_god_score >= 50 THEN '50-59 (Good)'
    WHEN total_god_score >= 40 THEN '40-49 (Fair)'
    ELSE 'Below 40 (Weak)'
  END as score_range,
  COUNT(*) as count,
  ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric, 1) as percentage
FROM startup_uploads
WHERE status = 'approved'
GROUP BY score_range
ORDER BY MIN(total_god_score) DESC;

-- Top 10 highest scores
SELECT 
  name,
  website,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score
FROM startup_uploads
WHERE status = 'approved'
ORDER BY total_god_score DESC
LIMIT 10;
