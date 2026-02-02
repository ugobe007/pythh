-- UNDO the cleanup - restore rejected entries
-- Run this in Supabase SQL Editor

BEGIN;

-- Restore entries that were rejected
UPDATE startup_uploads 
SET status = 'approved'
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Fund',
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
AND status = 'rejected';

-- Verify restoration
SELECT 'Restored entries in startup_uploads:' as check_type, COUNT(*) as count
FROM startup_uploads 
WHERE name IN (
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers'
)
AND status = 'approved';

COMMIT;
