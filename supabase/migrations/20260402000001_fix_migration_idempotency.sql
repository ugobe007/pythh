-- ═══════════════════════════════════════════════════════════════════════════════
-- IDEMPOTENCY GUARD FOR 20260331310000_convert_text_metric_cols_to_numeric
-- ═══════════════════════════════════════════════════════════════════════════════
-- PROBLEM:
--   Migration 20260331310000 converted latest_funding_amount TEXT → BIGINT and
--   growth_rate TEXT → NUMERIC. It succeeded. But the local migration history is
--   out of sync with the remote, so supabase db push tries to re-run it.
--   Re-running the cleanup queries (e.g. WHERE latest_funding_amount ~* 'NaN')
--   on a BIGINT column throws:
--     ERROR: 42883: operator does not exist: bigint ~* unknown
--
-- FIX:
--   This migration patches the cleanup queries to be type-aware using a PL/pgSQL
--   DO block that only executes the TEXT-based regex cleanup when the column is
--   still TEXT. If it is already BIGINT the block is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'startup_uploads'
    AND column_name  = 'latest_funding_amount';

  -- Only run TEXT-based cleanup when column is still TEXT
  IF col_type = 'text' THEN

    -- Null out NaN placeholder strings
    UPDATE public.startup_uploads
    SET latest_funding_amount = NULL
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount ~* 'NaN';

    -- Null out foreign-currency / unparseable strings
    UPDATE public.startup_uploads
    SET latest_funding_amount = NULL
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount !~ '^\$?[0-9][0-9,]*(\.[0-9]+)?[KkMmBb]?$';

    -- Expand B suffix
    UPDATE public.startup_uploads
    SET latest_funding_amount = (
      ROUND(
        REGEXP_REPLACE(REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g'), '[Bb]$', '', 'g')::numeric
        * 1000000000
      )::bigint
    )::text
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount ~* '\$?[0-9][0-9,]*(\.[0-9]+)?[Bb]$';

    -- Expand M suffix
    UPDATE public.startup_uploads
    SET latest_funding_amount = (
      ROUND(
        REGEXP_REPLACE(REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g'), '[Mm]$', '', 'g')::numeric
        * 1000000
      )::bigint
    )::text
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount ~* '\$?[0-9][0-9,]*(\.[0-9]+)?[Mm]$';

    -- Expand K suffix
    UPDATE public.startup_uploads
    SET latest_funding_amount = (
      ROUND(
        REGEXP_REPLACE(REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g'), '[Kk]$', '', 'g')::numeric
        * 1000
      )::bigint
    )::text
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount ~* '\$?[0-9][0-9,]*(\.[0-9]+)?[Kk]$';

    -- Strip leading $ and commas
    UPDATE public.startup_uploads
    SET latest_funding_amount = REGEXP_REPLACE(latest_funding_amount, '[$,]', '', 'g')
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount ~ '^\$?[0-9][0-9,]*(\.[0-9]+)?$';

    -- Round decimal strings
    UPDATE public.startup_uploads
    SET latest_funding_amount = ROUND(latest_funding_amount::numeric)::bigint::text
    WHERE latest_funding_amount IS NOT NULL
      AND latest_funding_amount ~ '^[0-9]+\.[0-9]+$';

    -- Convert TEXT → BIGINT
    ALTER TABLE public.startup_uploads
      ALTER COLUMN latest_funding_amount
        TYPE bigint
        USING CASE
          WHEN NULLIF(TRIM(latest_funding_amount), '') ~ '^[0-9]+$'
            THEN latest_funding_amount::bigint
          ELSE NULL
        END;

    RAISE NOTICE 'latest_funding_amount converted TEXT → BIGINT';
  ELSE
    RAISE NOTICE 'latest_funding_amount already %, skipping TEXT cleanup', col_type;
  END IF;

  -- growth_rate: same pattern
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'startup_uploads'
    AND column_name  = 'growth_rate';

  IF col_type = 'text' THEN
    ALTER TABLE public.startup_uploads
      ALTER COLUMN growth_rate
        TYPE numeric
        USING NULLIF(TRIM(growth_rate), '')::numeric;
    RAISE NOTICE 'growth_rate converted TEXT → NUMERIC';
  ELSE
    RAISE NOTICE 'growth_rate already %, skipping', col_type;
  END IF;
END
$$;

-- Recreate indexes safely
DROP INDEX IF EXISTS idx_startup_uploads_latest_funding;
DROP INDEX IF EXISTS idx_startup_uploads_growth_rate;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_latest_funding
  ON public.startup_uploads (latest_funding_amount)
  WHERE latest_funding_amount IS NOT NULL AND latest_funding_amount > 0;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_growth_rate
  ON public.startup_uploads (growth_rate)
  WHERE growth_rate IS NOT NULL AND growth_rate > 0;
