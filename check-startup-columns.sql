-- Check what columns exist in startup_uploads
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'startup_uploads' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
