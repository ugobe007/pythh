-- Postgres Timeout Diagnostic Script
-- Run this in Supabase SQL Editor to diagnose timeout issues

-- 1. Check current statement_timeout setting
SELECT 
  'Current statement_timeout' AS check_name,
  current_setting('statement_timeout') AS value;

-- 2. Check per-role settings
SELECT 
  'Per-role timeouts' AS check_name,
  rolname,
  rolconfig
FROM pg_roles 
WHERE rolname IN ('authenticated', 'anon', 'service_role', 'postgres')
ORDER BY rolname;

-- 3. Check indexes on startup_investor_matches
SELECT 
  'Existing indexes' AS check_name,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'startup_investor_matches'
ORDER BY indexname;

-- 4. Check table size (affects query performance)
SELECT 
  'Table size' AS check_name,
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE tablename = 'startup_investor_matches';

-- 5. Test query performance (replace UUID with real startup_id)
EXPLAIN ANALYZE
SELECT 
  investor_id, 
  match_score
FROM startup_investor_matches
WHERE startup_id = '11cd88ad-d464-4f5c-9e65-82da8ffe7e8a'
  AND match_score >= 20
ORDER BY match_score DESC
LIMIT 100;

-- Expected output interpretation:
-- 
-- If you see "Seq Scan" → Missing index (BAD)
-- If you see "Index Scan using sim_startup_score_idx" → Index working (GOOD)
-- Execution Time < 100ms → Query is fast enough (GOOD)
-- Execution Time > 1000ms → Query needs optimization (BAD)
