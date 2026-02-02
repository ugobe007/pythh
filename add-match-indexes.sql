-- Add index to speed up match queries
CREATE INDEX IF NOT EXISTS idx_matches_score_desc 
ON startup_investor_matches (match_score DESC);

-- Also add index on combined query pattern
CREATE INDEX IF NOT EXISTS idx_matches_score_startup 
ON startup_investor_matches (match_score DESC, startup_id, investor_id);
