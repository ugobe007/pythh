-- ============================================================================
-- FINAL WORKING VERSION - Proven to work with test_full_cases
-- ============================================================================

DROP FUNCTION IF EXISTS get_hot_matches(INT, INT);

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
  WITH ranked_matches AS (
    SELECT 
      m.id AS rm_match_id,
      -- Show real startup name (we have 12,000+ to showcase!)
      s.name AS rm_startup_name,
      s.id AS rm_startup_id,
      s.total_god_score::NUMERIC AS rm_startup_god_score,
    CASE 
      WHEN s.total_god_score >= 80 THEN 'Elite'
      WHEN s.total_god_score >= 70 THEN 'Excellent'
      WHEN s.total_god_score >= 60 THEN 'Strong'
      WHEN s.total_god_score >= 50 THEN 'Good'
      ELSE 'Fair'
    END AS rm_startup_tier,
    s.sectors AS rm_startup_sectors,
    CASE 
      WHEN s.stage = 1 THEN 'Pre-Seed'
      WHEN s.stage = 2 THEN 'Seed'
      WHEN s.stage = 3 THEN 'Series A'
      WHEN s.stage = 4 THEN 'Series B'
      WHEN s.stage = 5 THEN 'Series C+'
      ELSE 'Unknown'
    END AS rm_startup_stage,
    -- Investor name
    CASE 
      WHEN i.tier IN ('1', '2') AND COALESCE(i.public_profile, false) = false 
      THEN CONCAT('Tier ', i.tier::TEXT, ' ', COALESCE(i.investor_type, 'VC'))
      ELSE i.name
    END AS rm_investor_name,
    COALESCE(i.tier::TEXT, '3') AS rm_investor_tier,
    CASE 
      WHEN i.tier IN ('1', '2') AND COALESCE(i.public_profile, false) = false 
      THEN NULL
      ELSE i.firm
    END AS rm_investor_firm,
      m.match_score AS rm_match_score,
      m.created_at AS rm_created_at,
      false AS rm_is_anonymized,  -- Always show real names now
      ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY m.match_score DESC, m.created_at DESC) AS rn
    FROM 
      startup_investor_matches m
      INNER JOIN startup_uploads s ON m.startup_id = s.id
      INNER JOIN investors i ON m.investor_id = i.id
    WHERE 
      m.match_score >= 60  -- LOWERED for demo
      AND m.created_at >= NOW() - make_interval(hours => hours_ago)
      AND s.status = 'approved'
      AND s.total_god_score >= 50  -- LOWERED for demo
  )
  SELECT 
    rm_match_id,
    rm_startup_name,
    rm_startup_god_score,
    rm_startup_tier,
    rm_startup_sectors,
    rm_startup_stage,
    rm_investor_name,
    rm_investor_tier,
    rm_investor_firm,
    rm_match_score,
    rm_created_at,
    rm_is_anonymized
  FROM ranked_matches
  WHERE rn = 1  -- Only one match per startup for variety
  ORDER BY 
    rm_match_score DESC,
    RANDOM()  -- Add randomization for startup variety
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hot_matches IS 
'Returns recent high-quality matches for marketing/FOMO feed. Stage codes: 1=Pre-Seed, 2=Seed, 3=Series A, 4=Series B, 5=Series C+. Demo thresholds: score>=60, GOD>=50';

-- Test it
SELECT * FROM get_hot_matches(5, 720);
