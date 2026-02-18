-- ============================================================================
-- UPDATE get_startup_context RPC - Enhanced Startup Profile Data
-- ============================================================================
-- Date: February 17, 2026
-- Purpose: Add more fields to startup context for richer profile display
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
  v_entitlements record;
  v_industry_avg numeric;
  v_top_quartile numeric;
  v_percentile int;
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
  
  -- Get entitlements
  SELECT * INTO v_entitlements
  FROM public.startup_entitlements
  WHERE startup_id = p_startup_id;
  
  -- If no signals record exists, the COALESCE in the RETURN will handle NULL fields
  
  -- Calculate industry stats (using sectors) - only if sectors exist
  IF v_startup.sectors IS NOT NULL AND array_length(v_startup.sectors, 1) > 0 THEN
    SELECT 
      AVG(total_god_score),
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_god_score)
    INTO v_industry_avg, v_top_quartile
    FROM public.startup_uploads
    WHERE status = 'approved'
      AND sectors IS NOT NULL
      AND sectors && v_startup.sectors;
    
    -- Calculate percentile
    SELECT 
      (COUNT(*) FILTER (WHERE total_god_score < v_startup.total_god_score) * 100 / NULLIF(COUNT(*), 0))::int
    INTO v_percentile
    FROM public.startup_uploads
    WHERE status = 'approved'
      AND sectors IS NOT NULL
      AND sectors && v_startup.sectors;
  END IF;
  
  RETURN jsonb_build_object(
    'startup', jsonb_build_object(
      'name', v_startup.name,
      'website', v_startup.website,
      'tagline', v_startup.tagline,
      'description', COALESCE(v_startup.description, v_startup.pitch),
      'stage', v_startup.stage,
      'sectors', COALESCE(v_startup.sectors, ARRAY[]::text[]),
      'extracted_data', COALESCE(v_startup.extracted_data, '{}'::jsonb)
    ),
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
    'entitlements', jsonb_build_object(
      'plan', COALESCE(v_entitlements.plan, 'free'),
      'daily_unlock_limit', COALESCE(v_entitlements.daily_unlock_limit, 3),
      'unlocks_used_today', COALESCE(v_entitlements.unlocks_used_today, 0),
      'unlocks_remaining', CASE 
        WHEN v_entitlements IS NULL THEN 3
        ELSE v_entitlements.daily_unlock_limit - v_entitlements.unlocks_used_today
      END
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_startup_context IS 
  'Returns startup profile data including GOD scores, signals, comparison stats, and entitlements';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ get_startup_context function updated successfully';
  RAISE NOTICE '📊 Returns: name, website, tagline, description, stage, sectors, extracted_data';
END $$;
