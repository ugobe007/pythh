-- Test function with explicit 720 hours (30 days)
SELECT * FROM get_hot_matches(5, 720);

-- Also test with very long time window to see if ANY match comes back
SELECT * FROM get_hot_matches(5, 10000);
