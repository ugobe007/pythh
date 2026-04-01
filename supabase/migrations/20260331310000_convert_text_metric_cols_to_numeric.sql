-- ═══════════════════════════════════════════════════════════════════════════════
-- CONVERT TEXT METRIC COLUMNS TO PROPER NUMERIC TYPES
-- Migrated: 2026-03-31
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM:
--   latest_funding_amount and growth_rate were declared as TEXT in the original
--   schema, despite holding only numeric values. This causes:
--     - Operator errors when comparing TEXT > INTEGER in SQL (e.g., index predicates)
--     - Implicit type coercions throughout the codebase
--     - Misleading column definitions
--
-- This migration:
--   1. Drops the view startup_intel_v1 (which depends on growth_rate)
--   2. Normalises dirty text values in latest_funding_amount (scrapers wrote "$125M",
--      "INR 6,000 Cr", "16600000.000000002", "$NaNM", etc.)
--   3. Converts latest_funding_amount TEXT → BIGINT
--   4. Converts growth_rate TEXT → NUMERIC  (growth_rate values are clean)
--   5. Recreates startup_intel_v1 identically (definition fetched from live DB)
--
-- NOTE: startup_intel_v1 was created via Supabase Studio and was not tracked
-- in migrations. This migration captures its exact definition as of 2026-03-31.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Drop the dependent view ────────────────────────────────────────────────
-- CASCADE handles any objects that further depend on startup_intel_v1.
-- (None exist as of this migration, but CASCADE is defensive.)

DROP VIEW IF EXISTS public.startup_intel_v1 CASCADE;

-- ── 2. Normalize dirty text values in latest_funding_amount ──────────────────
-- The column has mixed formats from scrapers: "$125M", "$1.35b", "$500K",
-- "INR 6,000 Cr", "16600000.000000002", "$NaNM", etc.
-- We normalise in passes — most specific first — then cast what remains.

-- 2a. Null out NaN placeholder strings (e.g. "$NaNM", "$NaNB")
UPDATE public.startup_uploads
SET latest_funding_amount = NULL
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount ~* 'NaN';

-- 2b. Null out foreign-currency / unparseable strings
--     Keep only strings that look like: optional $, digits/commas/dots, optional K/M/B suffix
UPDATE public.startup_uploads
SET latest_funding_amount = NULL
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount !~ '^\$?[0-9][0-9,]*(\.[0-9]+)?[KkMmBb]?$';

-- 2c. Expand B/b suffix → × 1,000,000,000
UPDATE public.startup_uploads
SET latest_funding_amount = (
  ROUND(
    REGEXP_REPLACE(REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g'), '[Bb]$', '', 'g')::numeric
    * 1000000000
  )::bigint
)::text
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount ~* '\$?[0-9][0-9,]*(\.[0-9]+)?[Bb]$';

-- 2d. Expand M/m suffix → × 1,000,000
UPDATE public.startup_uploads
SET latest_funding_amount = (
  ROUND(
    REGEXP_REPLACE(REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g'), '[Mm]$', '', 'g')::numeric
    * 1000000
  )::bigint
)::text
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount ~* '\$?[0-9][0-9,]*(\.[0-9]+)?[Mm]$';

-- 2e. Expand K/k suffix → × 1,000
UPDATE public.startup_uploads
SET latest_funding_amount = (
  ROUND(
    REGEXP_REPLACE(REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g'), '[Kk]$', '', 'g')::numeric
    * 1000
  )::bigint
)::text
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount ~* '\$?[0-9][0-9,]*(\.[0-9]+)?[Kk]$';

-- 2f. Strip leading $ and commas from plain numeric strings
UPDATE public.startup_uploads
SET latest_funding_amount = REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g')
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount ~ '^\$?[0-9][0-9,]*(\.[0-9]+)?$';

-- 2g. Round any remaining decimal strings (e.g. "16600000.000000002")
UPDATE public.startup_uploads
SET latest_funding_amount = ROUND(latest_funding_amount::numeric)::bigint::text
WHERE latest_funding_amount IS NOT NULL
  AND latest_funding_amount ~ '^[0-9]+\.[0-9]+$';

-- ── 3. Convert TEXT columns to proper numeric types ───────────────────────────
-- After normalization, every surviving latest_funding_amount value is a plain
-- integer string.  The USING clause casts safely; anything unexpected → NULL.

ALTER TABLE public.startup_uploads
  ALTER COLUMN latest_funding_amount
    TYPE bigint
    USING CASE
      WHEN NULLIF(TRIM(latest_funding_amount), '') ~ '^[0-9]+$'
        THEN latest_funding_amount::bigint
      ELSE NULL
    END;

ALTER TABLE public.startup_uploads
  ALTER COLUMN growth_rate
    TYPE numeric
    USING NULLIF(TRIM(growth_rate), '')::numeric;

-- ── 4. Recreate startup_intel_v1 with corrected column references ─────────────
-- Exact definition as returned by pg_get_viewdef() from the live database.
-- growth_rate is now NUMERIC — no cast needed in the view, references work as-is.

CREATE OR REPLACE VIEW public.startup_intel_v1 AS
 WITH base AS (
         SELECT startup_uploads.id,
            startup_uploads.name,
            startup_uploads.website,
            startup_uploads.tagline,
            startup_uploads.description,
            startup_uploads.pitch,
            startup_uploads.total_god_score,
            startup_uploads.team_score,
            startup_uploads.traction_score,
            startup_uploads.market_score,
            startup_uploads.product_score,
            startup_uploads.vision_score,
            startup_uploads.industry_god_score,
            startup_uploads.benchmark_score,
            startup_uploads.pythia_score,
            startup_uploads.has_technical_cofounder,
            startup_uploads.founders_under_30,
            startup_uploads.founders_under_25,
            startup_uploads.first_time_founders,
            startup_uploads.team_size,
            startup_uploads.team_size_estimate,
            startup_uploads.has_revenue,
            startup_uploads.has_customers,
            startup_uploads.is_launched,
            startup_uploads.mrr,
            startup_uploads.arr,
            startup_uploads.revenue_annual,
            startup_uploads.customer_count,
            startup_uploads.growth_rate_monthly,
            startup_uploads.growth_rate,
            startup_uploads.nps_score,
            startup_uploads.dau_wau_ratio,
            startup_uploads.organic_referral_rate,
            startup_uploads.weeks_since_idea,
            startup_uploads.days_from_idea_to_mvp,
            startup_uploads.features_shipped_last_month,
            startup_uploads.deployment_frequency,
            startup_uploads.experiments_run_last_month,
            startup_uploads.hypotheses_validated,
            startup_uploads.pivot_speed_days,
            startup_uploads.pivots_made,
            startup_uploads.tam_estimate,
            startup_uploads.market_timing_score,
            startup_uploads.winner_take_all_market,
            startup_uploads.enabling_technology,
            startup_uploads.why_now,
            startup_uploads.smell_test_lean,
            startup_uploads.smell_test_user_passion,
            startup_uploads.smell_test_learning_public,
            startup_uploads.smell_test_inevitable,
            startup_uploads.smell_test_massive_if_works,
            startup_uploads.smell_test_score,
            startup_uploads.extracted_data,
            startup_uploads.customer_pain_data,
            startup_uploads.language_analysis,
            startup_uploads.contrarian_belief,
            startup_uploads.customer_interviews_conducted,
            startup_uploads.grit_signals,
            startup_uploads.execution_signals
           FROM startup_uploads
        ), scores AS (
         SELECT base.id,
            base.name,
            base.website,
            base.tagline,
            base.description,
            base.pitch,
            base.total_god_score,
            base.team_score,
            base.traction_score,
            base.market_score,
            base.product_score,
            base.vision_score,
            base.industry_god_score,
            base.benchmark_score,
            base.pythia_score,
            base.has_technical_cofounder,
            base.founders_under_30,
            base.founders_under_25,
            base.first_time_founders,
            base.team_size,
            base.team_size_estimate,
            base.has_revenue,
            base.has_customers,
            base.is_launched,
            base.mrr,
            base.arr,
            base.revenue_annual,
            base.customer_count,
            base.growth_rate_monthly,
            base.growth_rate,
            base.nps_score,
            base.dau_wau_ratio,
            base.organic_referral_rate,
            base.weeks_since_idea,
            base.days_from_idea_to_mvp,
            base.features_shipped_last_month,
            base.deployment_frequency,
            base.experiments_run_last_month,
            base.hypotheses_validated,
            base.pivot_speed_days,
            base.pivots_made,
            base.tam_estimate,
            base.market_timing_score,
            base.winner_take_all_market,
            base.enabling_technology,
            base.why_now,
            base.smell_test_lean,
            base.smell_test_user_passion,
            base.smell_test_learning_public,
            base.smell_test_inevitable,
            base.smell_test_massive_if_works,
            base.smell_test_score,
            base.extracted_data,
            base.customer_pain_data,
            base.language_analysis,
            base.contrarian_belief,
            base.customer_interviews_conducted,
            base.grit_signals,
            base.execution_signals,
            (
                CASE
                    WHEN COALESCE(NULLIF(base.tagline, ''::text), ''::text) <> ''::text THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(NULLIF(base.pitch, ''::text), ''::text) <> ''::text THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(NULLIF(base.description, ''::text), ''::text) <> ''::text THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(NULLIF(base.why_now, ''::text), ''::text) <> ''::text THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(NULLIF(base.contrarian_belief, ''::text), ''::text) <> ''::text THEN 1
                    ELSE 0
                END)::double precision AS narrative_completeness,
            LEAST(COALESCE(base.customer_interviews_conducted, 0), 50)::numeric * 0.06 + LEAST(COALESCE(base.pivots_made, 0), 10)::numeric * 0.25 +
                CASE
                    WHEN base.customer_pain_data IS NOT NULL AND base.customer_pain_data::text <> '{}'::text THEN 1
                    ELSE 0
                END::numeric * 1.0 +
                CASE
                    WHEN base.grit_signals IS NOT NULL AND cardinality(base.grit_signals) > 0 THEN 1
                    ELSE 0
                END::numeric * 0.75 +
                CASE
                    WHEN base.execution_signals IS NOT NULL AND cardinality(base.execution_signals) > 0 THEN 1
                    ELSE 0
                END::numeric * 0.75 AS obsession_density,
            (
                CASE
                    WHEN base.has_revenue THEN 1
                    ELSE 0
                END::numeric * 1.5 +
                CASE
                    WHEN base.has_customers THEN 1
                    ELSE 0
                END::numeric * 1.0 +
                CASE
                    WHEN base.is_launched THEN 1
                    ELSE 0
                END::numeric * 0.75)::double precision
              + LEAST(COALESCE(base.customer_count, 0), 500)::double precision * 0.004::double precision
              + LEAST(COALESCE(base.growth_rate_monthly, 0), 50)::double precision * 0.06::double precision
              + LEAST(COALESCE(base.nps_score, 0), 80)::double precision * 0.02::double precision AS evidence_score,
                CASE
                    WHEN COALESCE(base.team_size, base.team_size_estimate, 0) < 3 THEN 1
                    ELSE 0
                END::numeric * 1.0 +
                CASE
                    WHEN base.first_time_founders THEN 1
                    ELSE 0
                END::numeric * 0.8 +
                CASE
                    WHEN base.has_technical_cofounder IS FALSE THEN 1
                    ELSE 0
                END::numeric * 1.2 +
                CASE
                    WHEN COALESCE(base.founders_under_25, 0) > 0 THEN 1
                    ELSE 0
                END::numeric * 0.6 AS fragility_index,
                CASE
                    WHEN COALESCE(base.days_from_idea_to_mvp, 9999) <= 30 THEN 2.0
                    WHEN COALESCE(base.days_from_idea_to_mvp, 9999) <= 90 THEN 1.0
                    ELSE 0.0
                END::double precision
              + LEAST(COALESCE(base.features_shipped_last_month, 0), 30)::double precision * 0.08::double precision
              + LEAST(COALESCE(base.experiments_run_last_month, 0), 20)::double precision * 0.10::double precision
              + LEAST(COALESCE(base.hypotheses_validated, 0), 20)::double precision * 0.10::double precision +
                CASE
                    WHEN COALESCE(base.pivot_speed_days, 9999) <= 60 THEN 0.6
                    ELSE 0::numeric
                END::double precision AS momentum_score
           FROM base
        )
 SELECT id,
    name,
    website,
    tagline,
    description,
    pitch,
    total_god_score,
    team_score,
    traction_score,
    market_score,
    product_score,
    vision_score,
    industry_god_score,
    benchmark_score,
    pythia_score,
    has_technical_cofounder,
    founders_under_30,
    founders_under_25,
    first_time_founders,
    team_size,
    team_size_estimate,
    has_revenue,
    has_customers,
    is_launched,
    mrr,
    arr,
    revenue_annual,
    customer_count,
    growth_rate_monthly,
    growth_rate,
    nps_score,
    dau_wau_ratio,
    organic_referral_rate,
    weeks_since_idea,
    days_from_idea_to_mvp,
    features_shipped_last_month,
    deployment_frequency,
    experiments_run_last_month,
    hypotheses_validated,
    pivot_speed_days,
    pivots_made,
    tam_estimate,
    market_timing_score,
    winner_take_all_market,
    enabling_technology,
    why_now,
    smell_test_lean,
    smell_test_user_passion,
    smell_test_learning_public,
    smell_test_inevitable,
    smell_test_massive_if_works,
    smell_test_score,
    extracted_data,
    customer_pain_data,
    language_analysis,
    contrarian_belief,
    customer_interviews_conducted,
    grit_signals,
    execution_signals,
    narrative_completeness,
    obsession_density,
    evidence_score,
    fragility_index,
    momentum_score,
    COALESCE(total_god_score, 0)::double precision - evidence_score * 10.0::double precision AS conviction_evidence_gap
   FROM scores;

-- ── 4. Re-grant permissions (view was public before) ─────────────────────────
GRANT SELECT ON public.startup_intel_v1 TO anon, authenticated;

-- ── 5. Fix the indexes from the previous migration ────────────────────────────
-- Now that latest_funding_amount is BIGINT and growth_rate is NUMERIC,
-- we can use numeric predicates instead of IS NOT NULL.

DROP INDEX IF EXISTS idx_startup_uploads_latest_funding;
DROP INDEX IF EXISTS idx_startup_uploads_growth_rate;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_latest_funding
  ON public.startup_uploads (latest_funding_amount)
  WHERE latest_funding_amount IS NOT NULL AND latest_funding_amount > 0;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_growth_rate
  ON public.startup_uploads (growth_rate)
  WHERE growth_rate IS NOT NULL AND growth_rate > 0;
