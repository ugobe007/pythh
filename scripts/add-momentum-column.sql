-- T2: Add momentum_score column to startup_uploads
-- Stores the momentum bonus (0-8 pts) calculated by momentumScoringService.js
ALTER TABLE startup_uploads 
  ADD COLUMN IF NOT EXISTS momentum_score REAL DEFAULT 0;

-- Add a comment
COMMENT ON COLUMN startup_uploads.momentum_score IS 'T2 momentum bonus (0-8 pts): revenue + customer trajectory, product maturity, team strength, data completeness, score trajectory';
