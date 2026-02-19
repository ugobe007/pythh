-- Check all versions of get_hot_matches function
SELECT 
  proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname = 'get_hot_matches'
AND n.nspname = 'public';
