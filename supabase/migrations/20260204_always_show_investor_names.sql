-- ============================================================================
-- FIX: ALWAYS RETURN INVESTOR NAMES
-- ============================================================================
-- Previously investor_name was NULL for locked investors.
-- Now we always return names since:
--   1. Top 5 are auto-unlocked in UI
--   2. Names provide value even before full unlock
--   3. We want to show BOTH firm names (VCs) and individual names (angels)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_live_match_table(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_live_match_table(
  p_startup_id uuid,
  p_limit_unlocked int DEFAULT 5,
  p_limit_locked int DEFAULT 50
)
RETURNS TABLE (
  rank int,
  investor_id uuid,
  investor_name text,
  fit_bucket text,
  momentum_bucket text,
  signal_score numeric(4,1),
  why_summary text,
  is_locked boolean,
  is_fallback boolean,
  actions_allowed text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_signal_score numeric(4,1);
  v_unlocked int;
  v_locked int;
  v_total_limit int;
BEGIN
  -- Clamp inputs (prevents abuse)
  v_unlocked := LEAST(GREATEST(COALESCE(p_limit_unlocked, 5), 0), 10);
  v_locked   := LEAST(GREATEST(COALESCE(p_limit_locked, 50), 0), 100);
  v_total_limit := v_unlocked + v_locked;

  -- Cached signal score (startup-level)
  SELECT signals_total INTO v_signal_score
  FROM public.startup_signal_scores
  WHERE startup_id = p_startup_id;

  v_signal_score := COALESCE(v_signal_score, 5.0);

  RETURN QUERY
  WITH
  -- Tier A: Quality matches (score >= 50)
  primary_matches AS (
    SELECT
      m.investor_id,
      m.match_score,
      m.reasoning,
      false AS is_fallback
    FROM public.startup_investor_matches m
    WHERE m.startup_id = p_startup_id
      AND m.match_score >= 50
    ORDER BY m.match_score DESC
    LIMIT v_total_limit
  ),
  -- Count primary matches for fallback decision
  primary_count AS (
    SELECT COUNT(*) AS cnt FROM primary_matches
  ),
  -- Tier B: Fallback matches (all scores, used only if primary < 20)
  fallback_matches AS (
    SELECT
      m.investor_id,
      m.match_score,
      m.reasoning,
      true AS is_fallback
    FROM public.startup_investor_matches m
    WHERE m.startup_id = p_startup_id
    ORDER BY m.match_score DESC
    LIMIT 20
  ),
  -- Combine: use primary OR fallback (not both)
  top_matches AS (
    -- Use primary if count >= 20
    SELECT pm.* FROM primary_matches pm, primary_count pc
    WHERE pc.cnt >= 20
    
    UNION ALL
    
    -- Use fallback if primary < 20
    SELECT fm.* FROM fallback_matches fm, primary_count pc
    WHERE pc.cnt < 20
      AND NOT EXISTS (
        SELECT 1 FROM primary_matches pm
        WHERE pm.investor_id = fm.investor_id
      )
    
    UNION ALL
    
    -- Also include primary matches when using fallback
    SELECT pm.* FROM primary_matches pm, primary_count pc
    WHERE pc.cnt < 20
  ),
  with_unlock AS (
    SELECT
      tm.*,
      EXISTS (
        SELECT 1
        FROM public.investor_unlocks u
        WHERE u.startup_id = p_startup_id
          AND u.investor_id = tm.investor_id
      ) AS is_unlocked
    FROM top_matches tm
  ),
  with_details AS (
    SELECT
      wu.investor_id,
      wu.match_score,
      wu.reasoning,
      wu.is_unlocked,
      wu.is_fallback,
      i.name AS inv_name,
      i.firm AS inv_firm,
      i.type AS inv_type,
      COALESCE(f.fit_bucket, 'good') AS fit
    FROM with_unlock wu
    JOIN public.investors i
      ON i.id = wu.investor_id
    LEFT JOIN public.startup_investor_fit f
      ON f.startup_id = p_startup_id
     AND f.investor_id = wu.investor_id
    WHERE (i.status IS NULL OR i.status = 'active')
  ),
  unlocked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY match_score DESC) AS rn
    FROM with_details
    WHERE is_unlocked = true
  ),
  locked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY match_score DESC) AS rn
    FROM with_details
    WHERE is_unlocked = false
  ),
  combined AS (
    SELECT * FROM unlocked WHERE rn <= v_unlocked
    UNION ALL
    SELECT * FROM locked WHERE rn <= v_locked
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.match_score DESC)::int AS rank,
    c.investor_id,
    -- ALWAYS return investor name (was: only for unlocked)
    -- Format: "Name · Firm" for VCs, just "Name" for angels/individuals
    CASE 
      WHEN c.inv_firm IS NOT NULL AND c.inv_firm != c.inv_name
        THEN c.inv_name || ' · ' || c.inv_firm
      ELSE c.inv_name
    END AS investor_name,
    c.fit::text AS fit_bucket,
    CASE
      WHEN v_signal_score >= 8.0 THEN 'strong'
      WHEN v_signal_score >= 6.0 THEN 'emerging'
      WHEN v_signal_score >= 4.0 THEN 'neutral'
      ELSE 'cooling'
    END AS momentum_bucket,
    v_signal_score AS signal_score,
    COALESCE(c.reasoning, 'Sector and stage alignment') AS why_summary,
    NOT c.is_unlocked AS is_locked,
    c.is_fallback,
    CASE WHEN c.is_unlocked
      THEN ARRAY['view']::text[]
      ELSE ARRAY['unlock']::text[]
    END AS actions_allowed
  FROM combined c
  ORDER BY c.match_score DESC;
END;
$$;

COMMENT ON FUNCTION public.get_live_match_table IS 
  'Returns match table rows for /app/matches. Always includes investor names.
   
   Tier A (Primary): match_score >= 50
   Tier B (Fallback): If primary < 20, shows top 20 regardless of score
   
   is_fallback marks warming-up matches for UI badges.
   investor_name is ALWAYS populated (VCs show "Name · Firm", angels just "Name")';
