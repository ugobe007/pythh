-- ====================================================================
-- GET TOP MATCHES RPC (for Pattern A v1.1)
-- ====================================================================
-- Returns top N matches for a startup (used instead of count_matches)

-- Drop all possible existing versions
DROP FUNCTION IF EXISTS get_top_matches CASCADE;

CREATE FUNCTION get_top_matches(p_startup_id uuid, p_limit int DEFAULT 200)
RETURNS TABLE(
  investor_id uuid,
  investor_name text,
  firm text,
  match_score numeric,
  sectors jsonb,
  stage jsonb,
  check_size_min bigint,
  check_size_max bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.investor_id,
    i.name AS investor_name,
    i.firm,
    m.match_score,
    to_jsonb(i.sectors) AS sectors,
    to_jsonb(i.stage) AS stage,
    i.check_size_min,
    i.check_size_max
  FROM startup_investor_matches m
  JOIN investors i ON i.id = m.investor_id
  WHERE m.startup_id = p_startup_id
    AND i.status = 'active'
  ORDER BY m.match_score DESC, m.created_at DESC
  LIMIT p_limit;
END $$;

COMMENT ON FUNCTION get_top_matches IS 'Returns top N matches for a startup. Used by Pattern A v1.1 instead of count_matches.';
