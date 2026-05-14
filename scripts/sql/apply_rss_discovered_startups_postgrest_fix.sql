-- One-shot for SQL Editor / psql when `supabase db push` is blocked.
-- Fixes RSS → discovered_startups bigint/text issues (DROP DEFAULT on latest_funding_amount)
-- and reloads PostgREST schema cache.
--
-- Idempotent: safe to re-run.

DO $f$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'discovered_startups'
      AND column_name = 'latest_funding_amount'
  ) THEN
    ALTER TABLE public.discovered_startups
      ALTER COLUMN latest_funding_amount DROP DEFAULT;
  END IF;
END
$f$;

NOTIFY pgrst, 'reload schema';
