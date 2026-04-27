-- RSS fetch inserts into discovered_startups can fail with:
--   "column latest_funding_amount is of type bigint but expression is of type text"
-- when a legacy DEFAULT or trigger coerces the wrong type. Drop a bad default if present
-- (column may not exist in every fork — skip safely).
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
