-- Optimize get_hot_matches / get_sector_heat_map for 3M+ row match table.
-- Index creation is optional and may need CONCURRENTLY in Supabase SQL editor:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sim_hot_created_score
--     ON public.startup_investor_matches (created_at DESC, match_score DESC)
--     WHERE match_score >= 60;

DROP FUNCTION IF EXISTS get_hot_matches(INT, INT);
DROP FUNCTION IF EXISTS get_sector_heat_map(INT);

-- Hot matches: join after narrowing to recent high-score rows
CREATE OR REPLACE FUNCTION get_hot_matches(
  limit_count INT DEFAULT 10,
  hours_ago INT DEFAULT 24
)
RETURNS TABLE (
  match_id UUID,
  startup_name TEXT,
  startup_god_score NUMERIC,
  startup_tier TEXT,
  startup_sectors TEXT[],
  startup_stage TEXT,
  investor_name TEXT,
  investor_tier TEXT,
  investor_firm TEXT,
  match_score NUMERIC,
  created_at TIMESTAMPTZ,
  is_anonymized BOOLEAN
)
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '45s'
AS $$
BEGIN
  RETURN QUERY
  WITH hot AS (
    SELECT
      m.id,
      m.startup_id,
      m.investor_id,
      m.match_score,
      m.created_at
    FROM startup_investor_matches m
    WHERE m.match_score >= 60
      AND m.created_at >= NOW() - make_interval(hours => hours_ago)
    ORDER BY m.match_score DESC, m.created_at DESC
    LIMIT GREATEST(limit_count * 4, 40)
  )
  SELECT
    h.id AS match_id,
    CASE
      WHEN COALESCE(s.public_profile, false) = true THEN s.name
      ELSE CONCAT(
        CASE
          WHEN s.stage IN (1, 2) THEN 'Seed'
          WHEN s.stage >= 3 THEN 'Series ' || CHR(64 + s.stage - 2)
          ELSE 'Early Stage'
        END,
        ' ',
        COALESCE(s.sectors[1], 'Startup')
      )
    END AS startup_name,
    s.total_god_score::NUMERIC AS startup_god_score,
    CASE
      WHEN s.total_god_score >= 80 THEN 'Elite'
      WHEN s.total_god_score >= 70 THEN 'Excellent'
      WHEN s.total_god_score >= 60 THEN 'Strong'
      WHEN s.total_god_score >= 50 THEN 'Good'
      ELSE 'Fair'
    END AS startup_tier,
    s.sectors AS startup_sectors,
    CASE
      WHEN s.stage = 1 THEN 'Pre-Seed'
      WHEN s.stage = 2 THEN 'Seed'
      WHEN s.stage = 3 THEN 'Series A'
      WHEN s.stage = 4 THEN 'Series B'
      WHEN s.stage = 5 THEN 'Series C+'
      ELSE 'Unknown'
    END AS startup_stage,
    CASE
      WHEN i.tier IN ('1', '2') AND COALESCE(i.public_profile, false) = false
      THEN CONCAT('Tier ', i.tier::TEXT, ' ', COALESCE(i.investor_type, 'VC'))
      ELSE i.name
    END AS investor_name,
    COALESCE(i.tier::TEXT, '3') AS investor_tier,
    CASE
      WHEN i.tier IN ('1', '2') AND COALESCE(i.public_profile, false) = false
      THEN NULL
      ELSE i.firm
    END AS investor_firm,
    h.match_score,
    h.created_at,
    NOT COALESCE(s.public_profile, false) AS is_anonymized
  FROM hot h
  INNER JOIN startup_uploads s ON h.startup_id = s.id
  INNER JOIN investors i ON h.investor_id = i.id
  WHERE s.status = 'approved'
    AND s.total_god_score >= 50
  ORDER BY h.match_score DESC, h.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Sector heat: single-pass sector counts (skip expensive week-over-week subquery on full table)
CREATE OR REPLACE FUNCTION get_sector_heat_map(
  days_ago INT DEFAULT 7
)
RETURNS TABLE (
  sector TEXT,
  match_count BIGINT,
  avg_match_score NUMERIC,
  week_over_week_change NUMERIC,
  top_startups TEXT[]
)
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '45s'
AS $$
BEGIN
  RETURN QUERY
  WITH sample_matches AS (
    SELECT
      m.match_score,
      s.name,
      s.total_god_score,
      s.sectors
    FROM startup_investor_matches m
    INNER JOIN startup_uploads s ON m.startup_id = s.id
    WHERE m.created_at >= NOW() - make_interval(days => days_ago)
      AND s.status = 'approved'
      AND m.match_score >= 60
      AND s.sectors IS NOT NULL
      AND cardinality(s.sectors) > 0
    ORDER BY m.created_at DESC
    LIMIT 20000
  ),
  recent AS (
    SELECT
      sm.match_score,
      sm.name,
      sm.total_god_score,
      unnest(sm.sectors) AS sector
    FROM sample_matches sm
  ),
  grouped AS (
    SELECT
      r.sector,
      COUNT(*)::BIGINT AS matches,
      ROUND(AVG(r.match_score), 1) AS avg_score,
      ARRAY(
        SELECT DISTINCT n
        FROM (
          SELECT r2.name AS n
          FROM recent r2
          WHERE r2.sector = r.sector AND r2.total_god_score >= 60
          LIMIT 20
        ) sub
        LIMIT 3
      ) AS top_names
    FROM recent r
    GROUP BY r.sector
  )
  SELECT
    g.sector,
    g.matches AS match_count,
    g.avg_score AS avg_match_score,
    0.0::NUMERIC AS week_over_week_change,
    g.top_names[1:3] AS top_startups
  FROM grouped g
  WHERE g.matches >= 5
  ORDER BY g.matches DESC, g.avg_score DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hot_matches IS
  'Recent high-quality matches for marketing feed (optimized for large tables).';

COMMENT ON FUNCTION get_sector_heat_map IS
  'Trending sectors by match activity (optimized single-pass; WoW change deferred).';
