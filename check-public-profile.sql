-- Check if public_profile column actually exists and has values
SELECT 
  COUNT(*) as total,
  COUNT(public_profile) as has_public_profile,
  COUNT(*) FILTER (WHERE public_profile = true) as public_true,
  COUNT(*) FILTER (WHERE public_profile = false) as public_false,
  COUNT(*) FILTER (WHERE public_profile IS NULL) as public_null
FROM startup_uploads
WHERE status = 'approved';

-- Check investors table too
SELECT 
  COUNT(*) as total,
  COUNT(public_profile) as has_public_profile,
  COUNT(*) FILTER (WHERE public_profile = true) as public_true,
  COUNT(*) FILTER (WHERE public_profile = false) as public_false,
  COUNT(*) FILTER (WHERE public_profile IS NULL) as public_null
FROM investors;
