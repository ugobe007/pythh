-- ============================================================================
-- FIX: Clear Supabase function cache by dropping before recreating
-- ============================================================================
-- Issue: CREATE OR REPLACE doesn't clear compiled bytecode cache
-- Solution: DROP FUNCTION first, then CREATE fresh
-- ============================================================================

-- STEP 1: Drop the cached function
DROP FUNCTION IF EXISTS get_hot_matches(INT, INT);

-- STEP 2: Recreate with correct make_interval() syntax
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
    -- Anonymize startup name by default (can be overridden with startup setting)
    CASE 
      WHEN COALESCE(s.public_profile, false) = true THEN s.name
      ELSE CONCAT(
        CASE 
          WHEN s.stage = 'Pre-Seed' OR s.stage = 'Seed' THEN 'Seed'
          WHEN s.stage LIKE '%Series%' THEN REGEXP_REPLACE(s.stage, 'Series ([A-Z]).*', 'Series \1')
          ELSE 'Early Stage'
        END,
        ' ',
        COALESCE(s.sectors[1], 'Startup')
      )
    END AS startup_name,
    s.total_god_score AS startup_god_score,
    CASE 
      WHEN s.total_god_score >= 80 THEN 'Elite'
      WHEN s.total_god_score >= 70 THEN 'Excellent'
      WHEN s.total_god_score >= 60 THEN 'Strong'
      WHEN s.total_god_score >= 50 THEN 'Good'
      ELSE 'Fair'
    END AS startup_tier,
    s.sectors AS startup_sectors,
    COALESCE(s.stage, 'Unknown') AS startup_stage,
    -- Show investor name (Tier 1/2 prefer anonymity by default)
    CASE 
      WHEN i.tier IN ('1', '2') AND COALESCE(i.public_profile, false) = false 
      THEN CONCAT('Tier ', i.tier, ' ', COALESCE(i.investor_type, 'VC'))
      ELSE i.name
    END AS investor_name,
    COALESCE(i.tier, '3') AS investor_tier,
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
    -- High quality matches only
    m.match_score >= 75
    -- Recent matches (default 24h) - FIXED: use make_interval()
    AND m.created_at >= NOW() - make_interval(hours => hours_ago)
    -- Approved startups only
    AND s.status = 'approved'
    -- Strong startups (60+) only
    AND s.total_god_score >= 60
  ORDER BY 
    m.match_score DESC,
    m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hot_matches IS 
'Returns recent high-quality matches for marketing/FOMO feed. Anonymizes by default unless startup/investor opts in via public_profile flag.';
