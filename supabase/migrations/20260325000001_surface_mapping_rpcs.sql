-- ============================================================================
-- P2: Surface Level Mapping — hotspots, funding flows, investor activity
-- ============================================================================

-- get_sector_heat: Returns sector, startup_count, avg_god for main page
-- (PythhMain expects this shape; get_sector_heat_map has different signature)
DROP FUNCTION IF EXISTS public.get_sector_heat(integer);
CREATE OR REPLACE FUNCTION public.get_sector_heat(p_limit int DEFAULT 10)
RETURNS TABLE (
  sector text,
  startup_count bigint,
  avg_god numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s2.sector,
    COUNT(DISTINCT su.id)::bigint AS startup_count,
    ROUND(AVG(su.total_god_score)::numeric, 1) AS avg_god
  FROM (
    SELECT UNNEST(sectors) AS sector
    FROM startup_uploads
    WHERE status = 'approved' AND sectors IS NOT NULL
  ) s2
  JOIN startup_uploads su ON su.status = 'approved' AND su.sectors IS NOT NULL
    AND s2.sector = ANY(su.sectors)
  GROUP BY s2.sector
  HAVING COUNT(DISTINCT su.id) >= 3
  ORDER BY startup_count DESC, avg_god DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

COMMENT ON FUNCTION public.get_sector_heat(int) IS 'P2: Sector heat for main page. Returns sector, startup_count, avg_god.';

-- get_funding_by_sector: Who is getting funded and in what sectors
CREATE OR REPLACE FUNCTION public.get_funding_by_sector(p_days int DEFAULT 90)
RETURNS TABLE (
  sector text,
  deal_count bigint,
  avg_god numeric,
  top_investors text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_matches AS (
    SELECT m.startup_id, m.investor_id, s.sectors, s.total_god_score, i.name AS investor_name
    FROM startup_investor_matches m
    JOIN startup_uploads s ON s.id = m.startup_id AND s.status = 'approved'
    JOIN investors i ON i.id = m.investor_id
    WHERE m.created_at >= NOW() - (p_days || ' days')::interval
      AND m.match_score >= 50
  ),
  expanded AS (
    SELECT UNNEST(rm.sectors) AS sector, rm.startup_id, rm.total_god_score, rm.investor_name
    FROM recent_matches rm
    WHERE rm.sectors IS NOT NULL
  ),
  by_sector AS (
    SELECT
      sector,
      COUNT(DISTINCT startup_id)::bigint AS deal_count,
      ROUND(AVG(total_god_score)::numeric, 1) AS avg_god,
      ARRAY_AGG(DISTINCT investor_name) FILTER (WHERE investor_name IS NOT NULL) AS investors
    FROM expanded
    GROUP BY sector
    HAVING COUNT(DISTINCT startup_id) >= 2
  )
  SELECT
    sector,
    deal_count,
    avg_god,
    (SELECT ARRAY_AGG(x) FROM (SELECT unnest(investors) AS x LIMIT 5) sub) AS top_investors
  FROM by_sector
  ORDER BY deal_count DESC
  LIMIT 20;
$$;

COMMENT ON FUNCTION public.get_funding_by_sector(int) IS 'P2: Funding activity by sector with top investors.';

-- get_signal_counts: P2 Signal numeration — count signals by type
CREATE OR REPLACE FUNCTION public.get_signal_counts(p_startup_id uuid DEFAULT NULL)
RETURNS TABLE (
  signal_type text,
  signal_count bigint,
  latest_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event_type AS signal_type,
    COUNT(*)::bigint AS signal_count,
    MAX(occurred_at) AS latest_at
  FROM signal_events
  WHERE (p_startup_id IS NULL OR startup_id = p_startup_id)
  GROUP BY event_type
  ORDER BY signal_count DESC;
$$;

COMMENT ON FUNCTION public.get_signal_counts(uuid) IS 'P2: Signal numeration — counts by event_type.';
