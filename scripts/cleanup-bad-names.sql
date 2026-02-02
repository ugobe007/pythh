-- SQL-based cleanup for bad scraper extractions
-- Run this in Supabase SQL Editor with service role

BEGIN;

-- Step 1: Check current bad entries
SELECT 'Bad entries in startup_uploads:' as check_type, COUNT(*) as count
FROM startup_uploads 
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund', 'Fund',
  'Era', 'With', 'Competing', 'Building', 'Modern', 'Inside',
  'Tips', 'Data', 'Digital', 'Tech', 'Build', 'Every', 'Equity',
  'Fusion', 'Dropout', 'Team', 'Culture', 'Updates', 'Launch',
  'Software', 'European', 'Finnish', 'Swedish', 'Estonian', 'Danish',
  'Indian', 'German', 'French', 'British', 'Transit',
  'Healthcare', 'Benefits', 'College', 'University', 'Click',
  'Power', 'Bank', 'Sandbar', 'Stand', 'Wars', 'Break', 'Much',
  'Most', 'Coveted', 'Golden', 'Investor', 'Battlefield', 'And',
  'Moved', 'Out', 'Clicks', 'SLC', 'Zork'
)
UNION ALL
SELECT 'Bad entries in discovered_startups:' as check_type, COUNT(*) as count
FROM discovered_startups 
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund', 'Fund',
  'Era', 'With', 'Competing', 'Building', 'Modern', 'Inside',
  'Tips', 'Data', 'Digital', 'Tech', 'Build', 'Every', 'Equity',
  'Fusion', 'Dropout', 'Team', 'Culture', 'Updates', 'Launch',
  'Software', 'European', 'Finnish', 'Swedish', 'Estonian', 'Danish',
  'Indian', 'German', 'French', 'British', 'Transit',
  'Healthcare', 'Benefits', 'College', 'University', 'Click',
  'Power', 'Bank', 'Sandbar', 'Stand', 'Wars', 'Break', 'Much',
  'Most', 'Coveted', 'Golden', 'Investor', 'Battlefield', 'And',
  'Moved', 'Out', 'Clicks', 'SLC', 'Zork'
);

-- Step 2: Reject bad entries in startup_uploads
UPDATE startup_uploads 
SET status = 'rejected'
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund', 'Fund',
  'Era', 'With', 'Competing', 'Building', 'Modern', 'Inside',
  'Tips', 'Data', 'Digital', 'Tech', 'Build', 'Every', 'Equity',
  'Fusion', 'Dropout', 'Team', 'Culture', 'Updates', 'Launch',
  'Software', 'European', 'Finnish', 'Swedish', 'Estonian', 'Danish',
  'Indian', 'German', 'French', 'British', 'Transit',
  'Healthcare', 'Benefits', 'College', 'University', 'Click',
  'Power', 'Bank', 'Sandbar', 'Stand', 'Wars', 'Break', 'Much',
  'Most', 'Coveted', 'Golden', 'Investor', 'Battlefield', 'And',
  'Moved', 'Out', 'Clicks', 'SLC', 'Zork'
)
AND status != 'rejected';

-- Step 3: Delete bad entries from discovered_startups
DELETE FROM discovered_startups 
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund', 'Fund',
  'Era', 'With', 'Competing', 'Building', 'Modern', 'Inside',
  'Tips', 'Data', 'Digital', 'Tech', 'Build', 'Every', 'Equity',
  'Fusion', 'Dropout', 'Team', 'Culture', 'Updates', 'Launch',
  'Software', 'European', 'Finnish', 'Swedish', 'Estonian', 'Danish',
  'Indian', 'German', 'French', 'British', 'Transit',
  'Healthcare', 'Benefits', 'College', 'University', 'Click',
  'Power', 'Bank', 'Sandbar', 'Stand', 'Wars', 'Break', 'Much',
  'Most', 'Coveted', 'Golden', 'Investor', 'Battlefield', 'And',
  'Moved', 'Out', 'Clicks', 'SLC', 'Zork'
);

-- Step 4: Verify cleanup
SELECT 'Remaining bad in startup_uploads:' as check_type, COUNT(*) as count
FROM startup_uploads 
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund'
)
AND status != 'rejected'
UNION ALL
SELECT 'Remaining bad in discovered_startups:' as check_type, COUNT(*) as count
FROM discovered_startups 
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund'
);

COMMIT;

-- Expected result: Both counts should be 0
