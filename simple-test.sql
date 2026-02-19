-- Ultra-simple test: Remove ALL filters except approved status
SELECT 
  m.id,
  s.name,
  m.match_score,
  s.total_god_score,
  m.created_at,
  NOW() - m.created_at as age
FROM startup_investor_matches m
INNER JOIN startup_uploads s ON m.startup_id = s.id
INNER JOIN investors i ON m.investor_id = i.id
WHERE s.status = 'approved'
  AND m.match_score >= 60
  AND s.total_god_score >= 50
  AND m.created_at >= NOW() - INTERVAL '30 days'
ORDER BY m.match_score DESC, m.created_at DESC
LIMIT 5;
