-- RSS-ish discovered_startups — preview + optional deletes (SQL Editor: SQL only)
--
-- Forks may omit `imported_to_startups`, `startup_id`, etc. This picks a "pending" predicate
-- from information_schema at runtime. RSS-shaped = non-empty rss_source AND article_url.
-- Long-term: run fix-discovered-startups-schema.sql to normalize columns.

-- ── 0) Columns present (debug)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'discovered_startups'
ORDER BY ordinal_position;

-- ── 1) PREVIEW (dynamic — no hard-coded startup_id / imported_to_startups)
DO $preview$
DECLARE
  pending_expr text;
  rss_expr     text := $rss$(COALESCE(TRIM(rss_source), '') <> '' AND COALESCE(TRIM(article_url), '') <> '')$rss$;
  n_total      bigint;
  n_rss        bigint;
  n_short      bigint;
BEGIN
  IF to_regclass('public.discovered_startups') IS NULL THEN
    RAISE EXCEPTION 'Table public.discovered_startups not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'imported_to_startups'
  ) THEN
    pending_expr := '(COALESCE(imported_to_startups, false) = false)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'startup_id'
  ) THEN
    pending_expr := '(startup_id IS NULL)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'imported_at'
  ) THEN
    pending_expr := '(imported_at IS NULL)';
  ELSE
    pending_expr := 'true';
    RAISE NOTICE 'No imported_to_startups / startup_id / imported_at — pending = ALL rows; use RSS-shaped counts carefully before any DELETE.';
  END IF;

  EXECUTE 'SELECT COUNT(*)::bigint FROM discovered_startups' INTO n_total;

  EXECUTE format(
    'SELECT COUNT(*)::bigint FROM discovered_startups WHERE (%s) AND (%s)',
    pending_expr, rss_expr
  ) INTO n_rss;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'description'
  ) THEN
    EXECUTE format(
      'SELECT COUNT(*)::bigint FROM discovered_startups WHERE (%s) AND (%s) AND (description IS NULL OR LENGTH(TRIM(description)) < 80)',
      pending_expr, rss_expr
    ) INTO n_short;
  ELSE
    n_short := NULL;
  END IF;

  RAISE NOTICE 'pending_predicate = %', pending_expr;
  RAISE NOTICE 'total_discovered = %', n_total;
  RAISE NOTICE 'pending_rss_shaped = %', n_rss;
  IF n_short IS NULL THEN
    RAISE NOTICE 'pending_rss_shaped_short_body = (skipped: no description column)';
  ELSE
    RAISE NOTICE 'pending_rss_shaped_short_body = %', n_short;
  END IF;
END
$preview$;

-- Open the SQL Editor "Messages" / notices panel for the NOTICE lines above.

-- ── 2) DELETE short body — uncomment entire DO after reviewing NOTICES
/*
DO $del$
DECLARE
  pending_expr text;
  rss_expr text := $rss$(COALESCE(TRIM(rss_source), '') <> '' AND COALESCE(TRIM(article_url), '') <> '')$rss$;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'imported_to_startups')
    THEN pending_expr := '(COALESCE(imported_to_startups, false) = false)';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'startup_id')
    THEN pending_expr := '(startup_id IS NULL)';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'imported_at')
    THEN pending_expr := '(imported_at IS NULL)';
  ELSE pending_expr := 'true';
  END IF;
  EXECUTE format(
    'DELETE FROM discovered_startups WHERE (%s) AND (%s) AND (description IS NULL OR LENGTH(TRIM(description)) < 80)',
    pending_expr, rss_expr
  );
END
$del$;
*/

-- ── 3) DELETE all pending RSS-shaped — aggressive; uncomment only if intended
/*
DO $del2$
DECLARE
  pending_expr text;
  rss_expr text := $rss$(COALESCE(TRIM(rss_source), '') <> '' AND COALESCE(TRIM(article_url), '') <> '')$rss$;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'imported_to_startups')
    THEN pending_expr := '(COALESCE(imported_to_startups, false) = false)';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'startup_id')
    THEN pending_expr := '(startup_id IS NULL)';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discovered_startups' AND column_name = 'imported_at')
    THEN pending_expr := '(imported_at IS NULL)';
  ELSE pending_expr := 'true';
  END IF;
  EXECUTE format('DELETE FROM discovered_startups WHERE (%s) AND (%s)', pending_expr, rss_expr);
END
$del2$;
*/
