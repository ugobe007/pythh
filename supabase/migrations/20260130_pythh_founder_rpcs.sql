-- ============================================================================
-- Pythh Founder RPCs - Production Safe
-- ============================================================================
-- 
-- RPCs:
--   1. get_live_match_table  - /app/matches table data
--   2. perform_unlock        - Unlock action (idempotent, race-safe)
--   3. get_investor_reveal   - /app/investors/:id data
--   4. get_startup_context   - /app/startup data
--
-- SAFETY GUARANTEES:
--   - All RPCs use SET search_path = public, pg_temp
--   - Input limits clamped to prevent abuse
--   - Race-safe unlock with INSERT RETURNING
--   - No writes to match corpus (read-only)
-- ============================================================================

BEGIN;

-- ============================================================================
-- RPC: get_live_match_table (safe, limited, active-only, clamped)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_live_match_table(uuid, int, int);

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
  top_matches AS (
    SELECT
      m.investor_id,
      m.match_score,
      m.reasoning
    FROM public.startup_investor_matches m
    WHERE m.startup_id = p_startup_id
      AND m.match_score >= 50
    ORDER BY m.match_score DESC
    LIMIT v_total_limit
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
      i.name AS inv_name,
      i.firm AS inv_firm,
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
    CASE WHEN c.is_unlocked THEN
      CASE WHEN c.inv_firm IS NOT NULL
        THEN c.inv_name || ' · ' || c.inv_firm
        ELSE c.inv_name
      END
    ELSE NULL END AS investor_name,
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
    CASE WHEN c.is_unlocked
      THEN ARRAY['view']::text[]
      ELSE ARRAY['unlock']::text[]
    END AS actions_allowed
  FROM combined c
  ORDER BY c.match_score DESC;
END;
$$;

COMMENT ON FUNCTION public.get_live_match_table IS 
  'Returns exact UI rows for /app/matches table.
   SAFETY: Clamped limits (max 10 unlocked, 100 locked), active investors only.
   Uses idx_sims_startup_score_desc index.';

-- ============================================================================
-- RPC: perform_unlock (idempotent, race-safe, no double-charge)
-- ============================================================================

DROP FUNCTION IF EXISTS public.perform_unlock(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.perform_unlock(
  p_startup_id uuid,
  p_investor_id uuid,
  p_source text DEFAULT 'free_daily'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_daily_limit int;
  v_used_today int;
  v_last_reset date;
  v_inserted boolean := false;
  v_remaining int;
BEGIN
  -- Fast path: already unlocked (idempotent)
  IF EXISTS (
    SELECT 1
    FROM public.investor_unlocks
    WHERE startup_id = p_startup_id
      AND investor_id = p_investor_id
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_unlocked', true
    );
  END IF;

  -- Ensure entitlements row exists
  INSERT INTO public.startup_entitlements (startup_id)
  VALUES (p_startup_id)
  ON CONFLICT (startup_id) DO NOTHING;

  -- Lock entitlements row (prevents concurrent counter drift)
  SELECT
    daily_unlock_limit,
    unlocks_used_today,
    last_reset_at::date
  INTO v_daily_limit, v_used_today, v_last_reset
  FROM public.startup_entitlements
  WHERE startup_id = p_startup_id
  FOR UPDATE;

  -- Reset daily counter if new day
  IF v_last_reset IS NULL OR v_last_reset < CURRENT_DATE THEN
    UPDATE public.startup_entitlements
    SET unlocks_used_today = 0,
        last_reset_at = now(),
        updated_at = now()
    WHERE startup_id = p_startup_id;

    v_used_today := 0;
  END IF;

  -- Enforce daily limit for free_daily
  IF p_source = 'free_daily' AND v_used_today >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'daily_limit_reached',
      'unlocks_remaining', 0,
      'resets_at', (CURRENT_DATE + 1)::timestamptz
    );
  END IF;

  -- Insert unlock and detect success (prevents double-charge)
  WITH ins AS (
    INSERT INTO public.investor_unlocks (startup_id, investor_id, unlock_source)
    VALUES (p_startup_id, p_investor_id, p_source)
    ON CONFLICT (startup_id, investor_id) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS(SELECT 1 FROM ins) INTO v_inserted;

  IF NOT v_inserted THEN
    -- Someone else inserted first; do not charge
    RETURN jsonb_build_object(
      'success', true,
      'already_unlocked', true
    );
  END IF;

  -- Charge exactly once
  UPDATE public.startup_entitlements
  SET unlocks_used_today = unlocks_used_today + 1,
      updated_at = now()
  WHERE startup_id = p_startup_id
  RETURNING (daily_unlock_limit - unlocks_used_today) INTO v_remaining;

  -- Ledger (optional, but consistent)
  INSERT INTO public.unlock_ledger (startup_id, delta, reason, balance_after)
  VALUES (p_startup_id, -1, 'used', v_remaining);

  RETURN jsonb_build_object(
    'success', true,
    'already_unlocked', false,
    'unlocks_remaining', v_remaining
  );
END;
$$;

COMMENT ON FUNCTION public.perform_unlock IS 
  'Unlocks an investor identity for a startup.
   SAFETY: Idempotent, race-safe (INSERT RETURNING), FOR UPDATE lock.
   Returns { success, unlocks_remaining } or { success: false, error }.';

-- ============================================================================
-- RPC: get_investor_reveal
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_investor_reveal(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_investor_reveal(
  p_startup_id uuid,
  p_investor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_unlocked boolean;
  v_investor record;
  v_match record;
  v_fit record;
BEGIN
  -- Check if unlocked
  SELECT EXISTS(
    SELECT 1 FROM public.investor_unlocks
    WHERE startup_id = p_startup_id AND investor_id = p_investor_id
  ) INTO v_unlocked;
  
  IF NOT v_unlocked THEN
    RETURN jsonb_build_object(
      'unlock_required', true,
      'investor_id', p_investor_id
    );
  END IF;
  
  -- Get investor details
  SELECT * INTO v_investor
  FROM public.investors
  WHERE id = p_investor_id;
  
  -- Get match details
  SELECT * INTO v_match
  FROM public.startup_investor_matches
  WHERE startup_id = p_startup_id AND investor_id = p_investor_id;
  
  -- Get fit
  SELECT * INTO v_fit
  FROM public.startup_investor_fit
  WHERE startup_id = p_startup_id AND investor_id = p_investor_id;
  
  RETURN jsonb_build_object(
    'unlock_required', false,
    'investor', jsonb_build_object(
      'id', v_investor.id,
      'name', v_investor.name,
      'firm', v_investor.firm,
      'title', v_investor.title,
      'email', v_investor.email,
      'linkedin_url', v_investor.linkedin_url,
      'twitter_url', v_investor.twitter_url,
      'photo_url', v_investor.photo_url,
      'stage', v_investor.stage,
      'sectors', v_investor.sectors,
      'geography_focus', v_investor.geography_focus,
      'check_size_min', v_investor.check_size_min,
      'check_size_max', v_investor.check_size_max,
      'investment_thesis', v_investor.investment_thesis,
      'bio', v_investor.bio,
      'notable_investments', v_investor.notable_investments,
      'portfolio_companies', v_investor.portfolio_companies
    ),
    'match', jsonb_build_object(
      'score', v_match.match_score,
      'reasoning', v_match.reasoning,
      'confidence', v_match.confidence_level,
      'fit_analysis', v_match.fit_analysis
    ),
    'fit', jsonb_build_object(
      'bucket', COALESCE(v_fit.fit_bucket, 'good'),
      'score', v_fit.fit_score
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_investor_reveal IS 
  'Returns full investor profile ONLY if unlocked.
   Otherwise returns { unlock_required: true }.
   Used by /app/investors/:id page.';

-- ============================================================================
-- RPC: get_startup_context
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
  
  -- Calculate industry stats (using sectors)
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
  
  RETURN jsonb_build_object(
    'startup', jsonb_build_object(
      'name', v_startup.name,
      'website', v_startup.website,
      'tagline', v_startup.tagline,
      'description', COALESCE(v_startup.description, v_startup.pitch),
      'stage', v_startup.stage
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
  'Returns data for /app/startup page.
   Startup metadata, GOD breakdown, signals, industry comparison.
   No optimization hints - builds trust, not behavior.';

COMMIT;
