-- Full function with ALL CASE statements
DROP FUNCTION IF EXISTS test_full_cases(INT, INT);

CREATE OR REPLACE FUNCTION test_full_cases(
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
    -- Anonymize startup name
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
    -- Investor name
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
    m.match_score,
    m.created_at,
    NOT COALESCE(s.public_profile, false) AS is_anonymized
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
SELECT * FROM test_full_cases(5, 720);
