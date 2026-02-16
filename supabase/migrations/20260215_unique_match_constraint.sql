-- ============================================================================
-- ADD UNIQUE CONSTRAINT: startup_investor_matches(startup_id, investor_id)
-- ============================================================================
-- Fix: Matches were duplicating on every re-generation because upserts used
-- onConflict: 'id' but match objects never had an id field (UUIDs are DB-generated).
-- This meant every upsert inserted a new row instead of updating the existing one.
--
-- Step 1: Deduplicate existing rows (keep highest-scoring match per pair)
-- Step 2: Add unique constraint to prevent future duplicates
-- ============================================================================

BEGIN;

-- Step 1: Delete duplicate matches, keeping only the highest-scoring one per pair
DELETE FROM startup_investor_matches
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY startup_id, investor_id
        ORDER BY match_score DESC, created_at DESC
      ) AS row_num
    FROM startup_investor_matches
  ) ranked
  WHERE row_num > 1
);

-- Step 2: Add unique constraint
ALTER TABLE startup_investor_matches
  ADD CONSTRAINT unique_startup_investor_pair
  UNIQUE (startup_id, investor_id);

COMMIT;
