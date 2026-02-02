-- Check karumi.ai GOD score and recent changes
SELECT 
  id,
  name,
  website,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score,
  status,
  updated_at,
  created_at
FROM startup_uploads
WHERE website ILIKE '%karumi%' OR name ILIKE '%karumi%'
ORDER BY updated_at DESC;

-- Check if score_history table exists and has records for karumi
SELECT 
  startup_id,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score,
  changed_at,
  reason
FROM score_history
WHERE startup_id IN (
  SELECT id FROM startup_uploads WHERE website ILIKE '%karumi%' OR name ILIKE '%karumi%'
)
ORDER BY changed_at DESC
LIMIT 10;
