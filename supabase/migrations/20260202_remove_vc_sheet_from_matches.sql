-- ============================================================================
-- Remove "VC Sheet" from investor matches
-- ============================================================================
-- "VC Sheet" is a data source/aggregator, not an actual investor
-- This script marks it as inactive so it doesn't appear in match results
-- ============================================================================

-- Find and mark VC Sheet as inactive
UPDATE investors 
SET status = 'inactive',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%vc sheet%' 
   OR LOWER(firm) LIKE '%vc sheet%'
   OR name = 'VC Sheet';

-- Also check for similar non-investor entries
UPDATE investors
SET status = 'inactive',
    updated_at = NOW()
WHERE LOWER(name) IN (
  'crunchbase',
  'angellist',
  'pitchbook',
  'vc list',
  'investor database',
  'investor directory'
)
OR LOWER(firm) IN (
  'crunchbase',
  'angellist',
  'pitchbook'
);

-- Show what was updated
SELECT id, name, firm, status
FROM investors
WHERE status = 'inactive'
  AND (
    LOWER(name) LIKE '%vc sheet%'
    OR LOWER(firm) LIKE '%vc sheet%'
    OR LOWER(name) IN ('crunchbase', 'angellist', 'pitchbook')
  )
LIMIT 10;
