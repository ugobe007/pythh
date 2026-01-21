-- Postgres Timeout Fix Script
-- Choose Option A (quick), Option B (proper), or run both
-- Run this in Supabase SQL Editor

-- =============================================================
-- OPTION A: Raise statement_timeout (Immediate - 5 minutes)
-- =============================================================
-- Uncomment to apply:

-- ALTER ROLE authenticated SET statement_timeout = '10s';
-- ALTER ROLE anon SET statement_timeout = '10s';
-- ALTER ROLE service_role SET statement_timeout = '10s';

-- Verify it worked:
-- SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role');

-- After applying Option A:
-- 1. Restart server: pm2 restart api-server
-- 2. Test: BASE=http://localhost:3002 scripts/smoke-api.sh


-- =============================================================
-- OPTION B: Add Index (Proper Fix - 10-30 minutes)
-- =============================================================
-- Uncomment to apply:

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS sim_startup_score_idx
-- ON public.startup_investor_matches (startup_id, match_score DESC);

-- Monitor index build progress:
-- SELECT 
--   phase,
--   blocks_done,
--   blocks_total,
--   round(100.0 * blocks_done / NULLIF(blocks_total, 0), 2) AS pct_complete
-- FROM pg_stat_progress_create_index
-- WHERE relid = 'public.startup_investor_matches'::regclass;

-- After index completes, verify it's being used:
-- EXPLAIN ANALYZE
-- SELECT investor_id, match_score
-- FROM startup_investor_matches
-- WHERE startup_id = '11cd88ad-d464-4f5c-9e65-82da8ffe7e8a'
--   AND match_score >= 20
-- ORDER BY match_score DESC
-- LIMIT 100;

-- Expected: "Index Scan using sim_startup_score_idx" (not "Seq Scan")
-- Expected: Execution Time < 100ms


-- =============================================================
-- RECOMMENDED: Apply Both (Belt + Suspenders)
-- =============================================================
-- 1. First, apply Option A for immediate relief
-- 2. Then, apply Option B while system is live
-- 3. Monitor: pm2 logs api-server | grep is_postgres_timeout


-- =============================================================
-- Rollback (if needed)
-- =============================================================
-- To remove timeout setting:
-- ALTER ROLE authenticated RESET statement_timeout;
-- ALTER ROLE anon RESET statement_timeout;
-- ALTER ROLE service_role RESET statement_timeout;

-- To remove index:
-- DROP INDEX CONCURRENTLY IF EXISTS sim_startup_score_idx;
