-- Check what match data actually exists
SELECT 
  COUNT(*) as total_matches,
  COUNT(*) FILTER (WHERE m.match_score >= 75) as matches_75_plus,
  COUNT(*) FILTER (WHERE m.match_score >= 60) as matches_60_plus,
  COUNT(*) FILTER (WHERE m.match_score >= 50) as matches_50_plus,
  MIN(m.match_score) as min_score,
  MAX(m.match_score) as max_score,
  AVG(m.match_score) as avg_score,
  MAX(m.created_at) as most_recent_match,
  MIN(m.created_at) as oldest_match
FROM startup_investor_matches m
INNER JOIN startup_uploads s ON m.startup_id = s.id
WHERE s.status = 'approved';

-- Check a few sample matches
SELECT 
  m.match_score,
  s.total_god_score,
  s.status,
  m.created_at,
  s.stage
FROM startup_investor_matches m
INNER JOIN startup_uploads s ON m.startup_id = s.id
ORDER BY m.match_score DESC
LIMIT 10;
