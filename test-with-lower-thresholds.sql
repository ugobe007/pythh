-- Quick test: Lower thresholds to show some matches
SELECT * FROM get_hot_matches(5, 720) -- 30 days instead of 7
WHERE match_score >= 60;  -- Lower threshold from 75 to 60
