-- Test URL Normalization
-- Run this after creating the tables to verify normalization works

-- Test the normalize_url function
SELECT 
  'https://NucleoResearch.com/' AS input,
  normalize_url('https://NucleoResearch.com/') AS normalized;
-- Expected: nucleoresearch.com

SELECT 
  'HTTP://Example.COM' AS input,
  normalize_url('HTTP://Example.COM') AS normalized;
-- Expected: example.com

SELECT 
  '  stripe.com/  ' AS input,
  normalize_url('  stripe.com/  ') AS normalized;
-- Expected: stripe.com

-- Test duplicate prevention (should fail on second insert)
BEGIN;
  -- First insert should succeed
  INSERT INTO startup_jobs (url, status)
  VALUES ('https://test.com/', 'queued');
  
  -- Second insert with different case/protocol should fail (duplicate url_normalized)
  -- Uncomment to test:
  -- INSERT INTO startup_jobs (url, status)
  -- VALUES ('HTTP://TEST.COM', 'queued');
  
  -- This should show normalized url
  SELECT id, url, url_normalized, status 
  FROM startup_jobs 
  WHERE url_normalized = 'test.com';
ROLLBACK;

-- Test lookup by normalized URL
-- This is how backend should query jobs
SELECT id, url, url_normalized, status, created_at
FROM startup_jobs
WHERE url_normalized = normalize_url('https://NucleoResearch.com/')
ORDER BY created_at DESC
LIMIT 1;

-- Show all jobs with their normalized URLs
SELECT 
  id,
  url AS original_url,
  url_normalized,
  status,
  created_at
FROM startup_jobs
ORDER BY created_at DESC
LIMIT 10;
