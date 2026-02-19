-- ULTRA SIMPLE VERSION - just return basic fields, no CASE statements
DROP FUNCTION IF EXISTS test_simple_matches(INT, INT);

CREATE OR REPLACE FUNCTION test_simple_matches(
  limit_count INT DEFAULT 10,
  hours_ago INT DEFAULT 24
)
RETURNS TABLE (
  match_id UUID,
  startup_name TEXT,
  match_score NUMERIC,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    s.name AS startup_name,
    m.match_score,
    m.created_at
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
SELECT * FROM test_simple_matches(5, 720);
