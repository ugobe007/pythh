-- Check the data types of columns we're using in the function
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('startup_uploads', 'investors', 'startup_investor_matches')
AND column_name IN ('stage', 'tier', 'match_score', 'total_god_score', 'sectors', 'public_profile')
ORDER BY table_name, column_name;
