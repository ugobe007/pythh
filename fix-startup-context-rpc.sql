-- ============================================================================
-- FIX get_startup_context RPC - Safe field access
-- ============================================================================
-- Date: February 18, 2026
-- Purpose: Fix 400 error by safely accessing only existing fields
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_startup_context(uuid);

CREATE OR REPLACE FUNCTION public.get_startup_context(
  p_startup_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_startup record;
  v_signals record;
  v_industry_avg numeric;
  v_top_quartile numeric;
  v_percentile int;
  v_startup_obj jsonb;
BEGIN
  -- Get startup
  SELECT * INTO v_startup
  FROM public.startup_uploads
  WHERE id = p_startup_id;
  
  IF v_startup IS NULL THEN
    RETURN jsonb_build_object('error', 'startup_not_found');
  END IF;
  
  -- Get signals
  SELECT * INTO v_signals
  FROM public.startup_signal_scores
  WHERE startup_id = p_startup_id;
  
  -- Calculate industry stats (using sectors if they exist)
  IF v_startup.sectors IS NOT NULL THEN
    SELECT 
      AVG(total_god_score),
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_god_score)
    INTO v_industry_avg, v_top_quartile
    FROM public.startup_uploads
    WHERE status = 'approved'
      AND sectors && v_startup.sectors;
    
    -- Calculate percentile
    SELECT 
      (COUNT(*) FILTER (WHERE total_god_score < v_startup.total_god_score) * 100 / NULLIF(COUNT(*), 0))::int
    INTO v_percentile
    FROM public.startup_uploads
    WHERE status = 'approved'
      AND sectors && v_startup.sectors;
  END IF;
  
  -- Build startup object with only guaranteed fields
  -- Start with core fields that always exist
  v_startup_obj := jsonb_build_object(
    'name', COALESCE(v_startup.name, 'Unknown'),
    'website', v_startup.website,
    'tagline', v_startup.tagline,
    'description', COALESCE(v_startup.description, v_startup.pitch),
    'stage', v_startup.stage
  );
  
  -- Conditionally add optional fields if they exist in the record
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('logo', v_startup.logo);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Field doesn't exist, skip it
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('sectors', COALESCE(v_startup.sectors, ARRAY[]::text[]));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('raise_amount', v_startup.raise_amount);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('raise_type', v_startup.raise_type);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('problem', v_startup.problem);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('solution', v_startup.solution);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('value_proposition', v_startup.value_proposition);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    v_startup_obj := v_startup_obj || jsonb_build_object('extracted_data', v_startup.extracted_data);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'startup', v_startup_obj,
    'god', jsonb_build_object(
      'total', COALESCE(v_startup.total_god_score, 50),
      'team', COALESCE(v_startup.team_score, 0),
      'traction', COALESCE(v_startup.traction_score, 0),
      'market', COALESCE(v_startup.market_score, 0),
      'product', COALESCE(v_startup.product_score, 0),
      'vision', COALESCE(v_startup.vision_score, 0)
    ),
    'signals', jsonb_build_object(
      'total', COALESCE(v_signals.signals_total, 0),
      'founder_language_shift', COALESCE(v_signals.founder_language_shift, 0),
      'investor_receptivity', COALESCE(v_signals.investor_receptivity, 0),
      'news_momentum', COALESCE(v_signals.news_momentum, 0),
      'capital_convergence', COALESCE(v_signals.capital_convergence, 0),
      'execution_velocity', COALESCE(v_signals.execution_velocity, 0)
    ),
    'comparison', jsonb_build_object(
      'industry_avg', ROUND(COALESCE(v_industry_avg, 50), 1),
      'top_quartile', ROUND(COALESCE(v_top_quartile, 65), 1),
      'percentile', COALESCE(v_percentile, 50),
      'sectors', COALESCE(v_startup.sectors, ARRAY[]::text[])
    ),
    'entitlements', (
      SELECT jsonb_build_object(
        'plan', e.plan,
        'daily_unlock_limit', e.daily_unlock_limit,
        'unlocks_used_today', e.unlocks_used_today,
        'unlocks_remaining', e.daily_unlock_limit - e.unlocks_used_today
      )
      FROM public.startup_entitlements e
      WHERE e.startup_id = p_startup_id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_startup_context IS 
  'Returns startup profile data with safe field access for optional columns';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ get_startup_context function fixed';
  RAISE NOTICE '🛡️ Now safely handles missing optional fields';
END $$;
