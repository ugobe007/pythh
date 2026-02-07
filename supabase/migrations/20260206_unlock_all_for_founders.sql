-- ============================================================================
-- UNLOCK ALL: FULL TRANSPARENCY FOR FOUNDERS
-- ============================================================================
-- Previously investor details were locked until explicitly unlocked.
-- Now we show everything to founders upfront - this is our "candy":
--   1. All investor names visible
--   2. All investor details accessible
--   3. No unlock flow needed
-- 
-- This migration removes the locking mechanism entirely.
-- The investor_unlocks table remains for historical tracking but is no longer
-- used for access control.
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
  v_total_limit int;
BEGIN
  -- Total limit (combine both params for backwards compat)
  v_total_limit := LEAST(COALESCE(p_limit_unlocked, 5) + COALESCE(p_limit_locked, 50), 100);

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
  with_details AS (
    SELECT
      tm.investor_id,
      tm.match_score,
      tm.reasoning,
      tm.is_fallback,
      i.name AS inv_name,
      i.firm AS inv_firm,
      i.type AS inv_type,
      i.linkedin_url,
      i.twitter_url,
      i.email,
      COALESCE(f.fit_bucket, 'good') AS fit
    FROM top_matches tm
    JOIN public.investors i
      ON i.id = tm.investor_id
    LEFT JOIN public.startup_investor_fit f
      ON f.startup_id = p_startup_id
     AND f.investor_id = tm.investor_id
    WHERE (i.status IS NULL OR i.status = 'active')
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY match_score DESC) AS rn
    FROM with_details
  )
  SELECT
    r.rn::int AS rank,
    r.investor_id,
    -- Full investor name with firm
    CASE 
      WHEN r.inv_firm IS NOT NULL AND r.inv_firm != r.inv_name
        THEN r.inv_name || ' · ' || r.inv_firm
      ELSE r.inv_name
    END AS investor_name,
    r.fit::text AS fit_bucket,
    CASE
      WHEN v_signal_score >= 8.0 THEN 'strong'
      WHEN v_signal_score >= 6.0 THEN 'emerging'
      WHEN v_signal_score >= 4.0 THEN 'neutral'
      ELSE 'cooling'
    END AS momentum_bucket,
    v_signal_score AS signal_score,
    COALESCE(r.reasoning, 'Sector and stage alignment') AS why_summary,
    -- ALWAYS UNLOCKED - no locking mechanism
    false AS is_locked,
    r.is_fallback,
    -- ALWAYS can view - full transparency
    ARRAY['view']::text[] AS actions_allowed
  FROM ranked r
  WHERE r.rn <= v_total_limit
  ORDER BY r.match_score DESC;
END;
$$;

COMMENT ON FUNCTION public.get_live_match_table IS 
  'Returns match table rows for /app/matches. FULLY UNLOCKED for founders.
   
   Tier A (Primary): match_score >= 50
   Tier B (Fallback): If primary < 20, shows top 20 regardless of score
   
   is_locked is ALWAYS false - we show all investor details to founders.
   This is our "candy" - full transparency builds trust.';
