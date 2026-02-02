-- GOD Score Weights Versioning System
-- Ensures immutability and rollback capability

CREATE TABLE IF NOT EXISTS god_score_weights_versions (
  version TEXT PRIMARY KEY,
  weights JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  immutable BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  
  -- Invariant checks stored with version
  component_weight_sum NUMERIC(10,6) NOT NULL,
  max_signal_contribution NUMERIC(10,2) NOT NULL,
  
  -- Audit trail
  superseded_by TEXT REFERENCES god_score_weights_versions(version),
  superseded_at TIMESTAMPTZ
);

-- Index for quick active version lookup
CREATE INDEX IF NOT EXISTS idx_god_weights_active ON god_score_weights_versions(active) WHERE active = true;

-- Add weights_version to startup_uploads to track which version scored each startup
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS weights_version TEXT REFERENCES god_score_weights_versions(version);

-- Add score_explanation JSONB for debugging
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS score_explanation JSONB;

-- Function to get active weights version
CREATE OR REPLACE FUNCTION get_active_god_weights()
RETURNS JSONB AS $$
DECLARE
  active_weights JSONB;
BEGIN
  SELECT weights INTO active_weights
  FROM god_score_weights_versions
  WHERE active = true
  LIMIT 1;
  
  IF active_weights IS NULL THEN
    RAISE EXCEPTION 'No active GOD score weights version found';
  END IF;
  
  RETURN active_weights;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to supersede a version (only way to "change" weights)
CREATE OR REPLACE FUNCTION supersede_weights_version(
  old_version TEXT,
  new_version TEXT,
  new_weights JSONB,
  new_description TEXT
)
RETURNS TEXT AS $$
DECLARE
  weight_sum NUMERIC;
BEGIN
  -- Validate old version exists and is active
  IF NOT EXISTS (SELECT 1 FROM god_score_weights_versions WHERE version = old_version AND active = true) THEN
    RAISE EXCEPTION 'Version % is not active or does not exist', old_version;
  END IF;
  
  -- Validate new version doesn't exist
  IF EXISTS (SELECT 1 FROM god_score_weights_versions WHERE version = new_version) THEN
    RAISE EXCEPTION 'Version % already exists', new_version;
  END IF;
  
  -- Calculate component weight sum for invariant check
  SELECT SUM((value->>'weight')::numeric)
  INTO weight_sum
  FROM jsonb_each(new_weights->'componentWeights');
  
  -- Enforce invariant: component weights must sum to 1.0 (±0.001 tolerance)
  IF ABS(weight_sum - 1.0) > 0.001 THEN
    RAISE EXCEPTION 'Component weights sum to %, must equal 1.0', weight_sum;
  END IF;
  
  -- Insert new version
  INSERT INTO god_score_weights_versions (
    version,
    weights,
    created_at,
    immutable,
    active,
    description,
    component_weight_sum,
    max_signal_contribution
  ) VALUES (
    new_version,
    new_weights,
    NOW(),
    true,
    true,
    new_description,
    weight_sum,
    (new_weights->'invariants'->>'maxSignalContribution')::numeric
  );
  
  -- Mark old version as superseded and inactive
  UPDATE god_score_weights_versions
  SET 
    active = false,
    superseded_by = new_version,
    superseded_at = NOW()
  WHERE version = old_version;
  
  RETURN new_version;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback to a previous version
CREATE OR REPLACE FUNCTION rollback_to_weights_version(target_version TEXT)
RETURNS TEXT AS $$
DECLARE
  current_version TEXT;
BEGIN
  -- Get current active version
  SELECT version INTO current_version
  FROM god_score_weights_versions
  WHERE active = true
  LIMIT 1;
  
  -- Validate target version exists
  IF NOT EXISTS (SELECT 1 FROM god_score_weights_versions WHERE version = target_version) THEN
    RAISE EXCEPTION 'Version % does not exist', target_version;
  END IF;
  
  -- Mark current version inactive
  UPDATE god_score_weights_versions
  SET active = false
  WHERE version = current_version;
  
  -- Activate target version
  UPDATE god_score_weights_versions
  SET active = true
  WHERE version = target_version;
  
  RETURN target_version;
END;
$$ LANGUAGE plpgsql;

-- Insert the original v1.0.0 weights
INSERT INTO god_score_weights_versions (
  version,
  weights,
  created_at,
  immutable,
  active,
  description,
  component_weight_sum,
  max_signal_contribution
) VALUES (
  '1.0.0',
  '{
    "normalizationDivisor": 23,
    "baseBoostMinimum": 2.0,
    "vibeBonusCap": 1.0,
    "finalScoreMultiplier": 10,
    "componentWeights": {
      "team": 0.25,
      "traction": 0.25,
      "market": 0.20,
      "product": 0.15,
      "vision": 0.15
    },
    "invariants": {
      "componentWeightSum": 1.0,
      "normalizedFeatureBounds": [0, 1],
      "totalScoreBounds": [0, 100],
      "maxSignalContribution": 10
    }
  }'::jsonb,
  NOW(),
  true,
  true,
  'Original GOD score weights based on VC criteria (YC, Sequoia, Founders Fund, First Round, Seed/Angel, a16z)',
  1.0,
  10
)
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE god_score_weights_versions IS 'Immutable versioning system for GOD score weights. Prevents unauthorized changes and enables instant rollback.';
COMMENT ON COLUMN god_score_weights_versions.immutable IS 'Always true - versions cannot be edited, only superseded';
COMMENT ON COLUMN god_score_weights_versions.active IS 'Only one version can be active at a time';
COMMENT ON COLUMN startup_uploads.weights_version IS 'Tracks which weights version was used to compute this score';
COMMENT ON COLUMN startup_uploads.score_explanation IS 'Debugging payload: component scores, weighted contributions, top signals';
