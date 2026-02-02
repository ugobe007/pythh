-- FAST MODE PERFORMANCE INDEXES
-- ===============================
-- These indexes are critical for sub-second convergence API responses
-- Run this once in Supabase SQL Editor

-- Index 1: Fast "top N matches by score for a startup"
-- Used by: fast mode convergence endpoint
-- Pattern: WHERE startup_id = X ORDER BY match_score DESC LIMIT 25
CREATE INDEX IF NOT EXISTS idx_sims_startup_score_desc
ON public.startup_investor_matches (startup_id, match_score DESC);

-- Index 2: Fast "top N matches with status filter + ordered by score"
-- Used by: fast mode with status='suggested' filtering
-- Pattern: WHERE startup_id = X AND status = 'suggested' ORDER BY match_score DESC LIMIT 25
CREATE INDEX IF NOT EXISTS idx_sims_startup_status_score_desc
ON public.startup_investor_matches (startup_id, status, match_score DESC);

-- Index 3 (OPTIONAL): Latest matches for admin dashboards
-- Only create if you have admin pages showing "recent matches"
-- CREATE INDEX IF NOT EXISTS idx_sims_created_at_desc
-- ON public.startup_investor_matches (created_at DESC);

-- Verify indexes were created
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'startup_investor_matches'
ORDER BY indexname;

-- Expected output:
-- idx_sims_startup_score_desc        → (startup_id, match_score DESC)
-- idx_sims_startup_status_score_desc → (startup_id, status, match_score DESC)

-- Performance test: Verify the exact query pattern your fast endpoint uses
EXPLAIN (ANALYZE, BUFFERS)
SELECT investor_id, match_score, confidence_level, created_at
FROM public.startup_investor_matches
WHERE startup_id = (SELECT id FROM startup_uploads LIMIT 1)
  AND status = 'suggested'
  AND match_score >= 50
ORDER BY match_score DESC
LIMIT 25;

-- Look for: "Index Scan using idx_sims_startup_status_score_desc"
-- Execution time should be < 10ms
-- If you see "Seq Scan" → indexes not being used (check query pattern)
