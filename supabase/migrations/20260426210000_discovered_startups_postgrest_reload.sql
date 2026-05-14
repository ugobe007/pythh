-- After ALTER COLUMN / DROP DEFAULT on discovered_startups, PostgREST may still treat
-- latest_funding_amount as text in the API layer → "bigint but expression is of type text"
-- on insert. NOTIFY forces a schema reload so bindings match Postgres.
--
-- Safe to re-run: DROP DEFAULT is idempotent; NOTIFY is harmless if no listener.

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
