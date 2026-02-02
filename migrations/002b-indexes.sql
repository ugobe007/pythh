-- ====================================================================
-- BULLETPROOF FIXES - Part 2: Indexes (run AFTER 002-bulletproof-fixes.sql)
-- ====================================================================
-- 
-- IMPORTANT: Run these ONE AT A TIME in separate queries
-- (CONCURRENTLY cannot run in a transaction block)
-- ====================================================================

-- 1. Claim index (supports the claim predicate perfectly)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_match_runs_claim
ON match_runs (status, lock_expires_at, created_at);

-- 2. Startup matches by startup_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS sim_startup_id_idx
ON public.startup_investor_matches (startup_id);

-- 3. Latest match per startup (for MAX(created_at) queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS sim_startup_created_desc_idx
ON public.startup_investor_matches (startup_id, created_at DESC);
