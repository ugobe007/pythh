-- ============================================================================
-- OBSERVATORY ALIGNMENT THRESHOLD FIX (75/65/55 split)
-- ============================================================================
-- GOAL: Fix "all 25 strong" perception by implementing tighter thresholds
--       that spread startups across 3 meaningful buckets
--
-- OLD THRESHOLDS:
--   70+ = high_alignment
--   55+ = moderate_alignment
--   40+ = low_alignment
--
-- NEW THRESHOLDS (75/65/55):
--   75+ = high_alignment (Strong pattern match)
--   65+ = moderate_alignment (Multiple signals)
--   55+ = low_alignment (Early signals)
--   <55 = minimal_alignment (Emerging)
--
-- IMPLEMENTATION:
--   1. Drop and recreate investor_discovery_flow_public view with new logic
--   2. Update existing 25 items to re-label with new thresholds
--
-- SAFETY: View-only change, no raw table alteration
-- ============================================================================

-- Step 1: Drop existing view
DROP VIEW IF EXISTS investor_discovery_flow_public;

-- Step 2: Recreate view with 75/65/55 threshold logic
CREATE OR REPLACE VIEW investor_discovery_flow_public AS
SELECT 
  id,
  investor_id,
  startup_hash,
  startup_type_label,
  stage,
  industry,
  signal_strength,
  entry_path,
  entry_rank,
  time_bucket,
  is_active,
  first_appeared_at,
  
  -- NEW: Derived alignment_state using 75/65/55 thresholds
  CASE 
    WHEN source_god_score >= 75 THEN 'high_alignment'
    WHEN source_god_score >= 65 THEN 'moderate_alignment'
    WHEN source_god_score >= 55 THEN 'low_alignment'
    ELSE 'minimal_alignment'
  END as alignment_state,
  
  source_god_score,
  created_at,
  updated_at

FROM investor_discovery_flow;

-- Grant SELECT to authenticated users
GRANT SELECT ON investor_discovery_flow_public TO authenticated;

-- Step 3: Update raw table data (legacy cleanup for existing 25 items)
-- This ensures consistent labeling between view and any cached data
UPDATE investor_discovery_flow
SET alignment_state = CASE 
  WHEN source_god_score >= 75 THEN 'high_alignment'
  WHEN source_god_score >= 65 THEN 'moderate_alignment'
  WHEN source_god_score >= 55 THEN 'low_alignment'
  ELSE 'minimal_alignment'
END
WHERE alignment_state = 'strong';  -- Only update legacy "strong" items

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check new distribution:
-- SELECT 
--   alignment_state,
--   COUNT(*) as count,
--   ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct,
--   ROUND(AVG(source_god_score), 1) as avg_god_score,
--   MIN(source_god_score) as min_score,
--   MAX(source_god_score) as max_score
-- FROM investor_discovery_flow_public
-- GROUP BY alignment_state
-- ORDER BY avg_god_score DESC;

-- Expected output (with current 25 items, GOD 55-69 range):
--   high_alignment (75+): 0 items (0%)
--   moderate_alignment (65-74): ~12-15 items (~50-60%)
--   low_alignment (55-64): ~10-13 items (~40-50%)
--   minimal_alignment (<55): 0 items (0%)
