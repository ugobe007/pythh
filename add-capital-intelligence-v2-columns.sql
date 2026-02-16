-- Capital Intelligence v2 Migration
-- Adds: effective_capital_power, deployment_velocity_index
-- Updates: fund_size_confidence (now uses Data Density Multiplier)
-- Feb 15, 2026

-- New columns
ALTER TABLE investors ADD COLUMN IF NOT EXISTS effective_capital_power REAL;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS deployment_velocity_index REAL;

-- Indexes for matching/ranking queries
CREATE INDEX IF NOT EXISTS idx_investors_effective_capital ON investors (effective_capital_power DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_investors_deployment_velocity ON investors (deployment_velocity_index DESC NULLS LAST);

-- Comments for documentation
COMMENT ON COLUMN investors.effective_capital_power IS 'capital_power_score × fund_size_confidence — confidence-weighted capital ranking';
COMMENT ON COLUMN investors.deployment_velocity_index IS '0-5 continuous scale: how aggressively the investor deploys capital (deals/year)';
