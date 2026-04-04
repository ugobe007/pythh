-- Coalesce startup narrative for get_startup_context (matches /api/preview effectiveStartupDescription)
-- so RPC clients see the same blurb when top-level description is null but extracted_data has text.

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
  v_description text;
BEGIN
  SELECT * INTO v_startup
  FROM public.startup_uploads
  WHERE id = p_startup_id;

  IF v_startup IS NULL THEN
    RETURN jsonb_build_object('error', 'startup_not_found');
  END IF;

  v_description := COALESCE(
    NULLIF(btrim(COALESCE(v_startup.description, '')), ''),
    NULLIF(btrim(COALESCE(v_startup.pitch, '')), ''),
    NULLIF(btrim(COALESCE(v_startup.extracted_data->>'description', '')), ''),
    NULLIF(btrim(COALESCE(v_startup.extracted_data->>'product_description', '')), ''),
    NULLIF(btrim(COALESCE(v_startup.extracted_data->>'value_proposition', '')), ''),
    NULLIF(btrim(COALESCE(v_startup.extracted_data->>'pitch', '')), '')
  );

  SELECT * INTO v_signals
  FROM public.startup_signal_scores
  WHERE startup_id = p_startup_id;

  SELECT
    AVG(total_god_score),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_god_score)
  INTO v_industry_avg, v_top_quartile
  FROM public.startup_uploads
  WHERE status = 'approved'
    AND sectors && v_startup.sectors;

  SELECT
    (COUNT(*) FILTER (WHERE total_god_score < v_startup.total_god_score) * 100 / NULLIF(COUNT(*), 0))::int
  INTO v_percentile
  FROM public.startup_uploads
  WHERE status = 'approved'
    AND sectors && v_startup.sectors;

  RETURN jsonb_build_object(
    'startup', jsonb_build_object(
      'name', v_startup.name,
      'website', v_startup.website,
      'tagline', v_startup.tagline,
      'description', v_description,
      'stage', v_startup.stage,
      'logo', v_startup.logo,
      'sectors', v_startup.sectors,
      'raise_amount', v_startup.raise_amount,
      'raise_type', v_startup.raise_type,
      'problem', v_startup.problem,
      'solution', v_startup.solution,
      'value_proposition', v_startup.value_proposition,
      'extracted_data', v_startup.extracted_data,
      'deck_filename', v_startup.deck_filename,
      'deck_url', v_startup.deck_url,
      'maturity_level', v_startup.maturity_level,
      'maturity_score', v_startup.maturity_score,
      'maturity_gaps', COALESCE(v_startup.maturity_gaps, '[]'::jsonb)
    ),
    'god', jsonb_build_object(
      'total', v_startup.total_god_score,
      'team', v_startup.team_score,
      'traction', v_startup.traction_score,
      'market', v_startup.market_score,
      'product', v_startup.product_score,
      'vision', v_startup.vision_score
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
      'industry_avg', ROUND(v_industry_avg, 1),
      'top_quartile', ROUND(v_top_quartile, 1),
      'percentile', v_percentile,
      'sectors', v_startup.sectors
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
  'Startup profile for UI. description coalesces pitch + extracted_data narrative fields when columns are empty.';

GRANT EXECUTE ON FUNCTION public.get_startup_context(uuid) TO anon, authenticated;
