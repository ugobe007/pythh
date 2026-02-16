-- Fund Size Inference Engine: Add structured capital intelligence columns
-- These columns support the inference framework that classifies investor capital types,
-- infers fund sizes from structural signals, and computes capital power scores.

-- Capital type classification (single_fund, total_aum, platform_capital, micro_vc)
ALTER TABLE investors ADD COLUMN IF NOT EXISTS capital_type text;

-- Inferred or reported fund size in USD (numeric for computation)
ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_size_estimate_usd bigint;

-- Confidence in the fund_size_estimate (0.0 = no data, 1.0 = officially reported)
ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_size_confidence real;

-- How the fund size was determined (reported, check_size_inference, portfolio_count_inference, geo_stage_inference, multi_signal, none)
ALTER TABLE investors ADD COLUMN IF NOT EXISTS estimation_method text;

-- Capital power score: log10-based 0-5 scale ($20M=1, $75M=2, $250M=3, $1B=4, $10B=5)
ALTER TABLE investors ADD COLUMN IF NOT EXISTS capital_power_score real;

-- Add an index on capital_power_score for ranking queries
CREATE INDEX IF NOT EXISTS idx_investors_capital_power ON investors (capital_power_score DESC NULLS LAST);

-- Add an index on capital_type for filtering
CREATE INDEX IF NOT EXISTS idx_investors_capital_type ON investors (capital_type);
