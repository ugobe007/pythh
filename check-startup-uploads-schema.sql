-- Check actual columns in startup_uploads table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'startup_uploads'
ORDER BY ordinal_position;
