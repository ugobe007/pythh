-- Add back CASE statements one by one to find the bug
DROP FUNCTION IF EXISTS test_incremental(INT, INT);

CREATE OR REPLACE FUNCTION test_incremental(
  limit_count INT DEFAULT 10,
  hours_ago INT DEFAULT 24
)
RETURNS TABLE (
  match_id UUID,
  startup_name TEXT,
  investor_name TEXT,
  investor_tier TEXT,
  match_score NUMERIC
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    s.name AS startup_name,
    i.name AS investor_name,
    i.tier::TEXT AS investor_tier,  -- Test tier casting
    m.match_score
  FROM 
    startup_investor_matches m
    INNER JOIN startup_uploads s ON m.startup_id = s.id
    INNER JOIN investors i ON m.investor_id = i.id
  WHERE 
    m.match_score >= 60
    AND m.created_at >= NOW() - make_interval(hours => hours_ago)
    AND s.status = 'approved'
    AND s.total_god_score >= 50
  ORDER BY 
    m.match_score DESC,
    m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Test it
SELECT * FROM test_incremental(5, 720);
