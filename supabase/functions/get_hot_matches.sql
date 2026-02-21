-- ============================================================================
-- GET HOT MATCHES - Marketing Feed Query
-- ============================================================================
-- Returns recent high-quality matches for public/dashboard display
-- Anonymized by default, respects privacy settings
--
-- Usage:
--   SELECT * FROM get_hot_matches(limit_count := 10, hours_ago := 24);
-- ============================================================================

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
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    -- Anonymize startup name by default
    CASE 
      WHEN COALESCE(s.public_profile, false) = true THEN s.name
      ELSE CONCAT(
        CASE 
          WHEN s.stage IN (1, 2) THEN 'Seed'  -- Pre-Seed=1, Seed=2
          WHEN s.stage >= 3 THEN 'Series ' || CHR(64 + s.stage - 2)  -- Series A=3, B=4, etc.
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
    -- Show investor name
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
    m.match_score AS match_score,
    m.created_at AS created_at,
    NOT COALESCE(s.public_profile, false) AS is_anonymized
  FROM 
    startup_investor_matches m
    INNER JOIN startup_uploads s ON m.startup_id = s.id
    INNER JOIN investors i ON m.investor_id = i.id
  WHERE 
    m.match_score >= 60  -- Lowered from 75 for demo
    AND m.created_at >= NOW() - make_interval(hours => hours_ago)
    AND s.status = 'approved'
    AND s.total_god_score >= 50  -- Lowered from 60 for demo
  ORDER BY 
    m.match_score DESC,
    m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hot_matches IS 
'Returns recent high-quality matches for marketing/FOMO feed. Anonymizes by default unless startup/investor opts in via public_profile flag. Stage codes: 1=Pre-Seed, 2=Seed, 3=Series A, 4=Series B, 5=Series C+';


-- ============================================================================
-- GET SECTOR HEAT MAP - Trending Sectors
-- ============================================================================
-- Returns match activity by sector for the last N days
-- ============================================================================

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
AS $$
BEGIN
  RETURN QUERY
  WITH current_week AS (
    SELECT 
      UNNEST(s.sectors) AS sector,
      COUNT(*) AS matches,
      AVG(m.match_score) AS avg_score,
      -- Deduplicated: one row per startup → distinct names only
      ARRAY(
        SELECT DISTINCT n
        FROM UNNEST(
          ARRAY_AGG(s.name) FILTER (WHERE s.total_god_score >= 60)
        ) n
        LIMIT 3
      ) AS top_names
    FROM 
      startup_investor_matches m
      INNER JOIN startup_uploads s ON m.startup_id = s.id
    WHERE 
      m.created_at >= NOW() - make_interval(days => days_ago)
      AND s.status = 'approved'
      AND m.match_score >= 60
    GROUP BY UNNEST(s.sectors)
  ),
  previous_week AS (
    SELECT 
      UNNEST(s.sectors) AS sector,
      COUNT(*) AS matches
    FROM 
      startup_investor_matches m
      INNER JOIN startup_uploads s ON m.startup_id = s.id
    WHERE 
      m.created_at >= NOW() - make_interval(days => days_ago * 2)
      AND m.created_at < NOW() - make_interval(days => days_ago)
      AND s.status = 'approved'
      AND m.match_score >= 60
    GROUP BY UNNEST(s.sectors)
  )
  SELECT 
    cw.sector,
    cw.matches AS match_count,
    ROUND(cw.avg_score, 1) AS avg_match_score,
    CASE 
      WHEN pw.matches IS NULL OR pw.matches = 0 THEN 100.0
      ELSE ROUND(((cw.matches - pw.matches)::NUMERIC / pw.matches) * 100, 1)
    END AS week_over_week_change,
    cw.top_names[1:3] AS top_startups
  FROM 
    current_week cw
    LEFT JOIN previous_week pw ON cw.sector = pw.sector
  WHERE 
    cw.matches >= 5  -- Minimum 5 matches to show
  ORDER BY 
    cw.matches DESC,
    cw.avg_score DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sector_heat_map IS 
'Returns trending sectors by match activity with week-over-week change.';


-- ============================================================================
-- GET PLATFORM VELOCITY - Real-time Stats
-- ============================================================================
-- Returns live platform metrics for ticker/counters
-- ============================================================================

CREATE OR REPLACE FUNCTION get_platform_velocity()
RETURNS TABLE (
  total_matches_today BIGINT,
  total_matches_week BIGINT,
  startups_discovered_today BIGINT,
  high_quality_matches_today BIGINT,
  avg_match_score_today NUMERIC,
  top_tier_activity_today BIGINT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM startup_investor_matches WHERE created_at >= CURRENT_DATE) AS total_matches_today,
    (SELECT COUNT(*) FROM startup_investor_matches WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS total_matches_week,
    (SELECT COUNT(*) FROM discovered_startups WHERE discovered_at >= CURRENT_DATE) AS startups_discovered_today,
    (SELECT COUNT(*) FROM startup_investor_matches WHERE created_at >= CURRENT_DATE AND match_score >= 80) AS high_quality_matches_today,
    (SELECT ROUND(AVG(match_score), 1) FROM startup_investor_matches WHERE created_at >= CURRENT_DATE) AS avg_match_score_today,
    (SELECT COUNT(*) FROM startup_investor_matches m 
     INNER JOIN investors i ON m.investor_id = i.id 
     WHERE m.created_at >= CURRENT_DATE AND i.tier = '1') AS top_tier_activity_today;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_platform_velocity IS 
'Returns real-time platform activity metrics for live counters and tickers.';
