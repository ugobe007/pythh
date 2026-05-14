-- Post-migration housekeeping
--
-- Supabase SQL Editor: paste ONLY the statements below (do not paste `psql` or shell commands).
--
-- Local terminal (requires DATABASE_URL in your environment, not empty):
--   set -a && source .env && set +a && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/database_cleanup_post_migrations.sql
--
-- 1) Remove duplicate pythh_matches rows (keeps newest per entity_id + candidate_id + trajectory_id).
--    Safe to re-run; mirrors the DELETE in supabase/migrations/20260426140000_pythh_matches_dedupe_and_unique.sql
--    without repeating ALTER/CREATE INDEX (already applied if that migration ran).
-- 2) Refresh planner stats after RSS / matches churn.

DELETE FROM pythh_matches p
USING (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY entity_id, candidate_id, trajectory_id
             ORDER BY matched_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM pythh_matches
  ) ranked
  WHERE ranked.rn > 1
) losers
WHERE p.id = losers.id;

ANALYZE public.discovered_startups;
ANALYZE public.pythh_matches;
