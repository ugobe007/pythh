-- VERIFY FAST MODE INDEXES
-- =========================
-- Run this after creating the indexes to confirm they exist

-- Check if indexes exist
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'startup_investor_matches'
  AND indexname LIKE 'idx_sims%'
ORDER BY indexname;

-- Should return 2 rows:
-- idx_sims_startup_score
-- idx_sims_startup_status_score

-- If empty, indexes weren't created - check for errors
