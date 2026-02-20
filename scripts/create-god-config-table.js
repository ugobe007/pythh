// Try to create god_algorithm_config table via HTTP API
require('dotenv').config();
const https = require('https');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const projectRef = url.replace('https://', '').replace('.supabase.co', '');

const sql = `
CREATE TABLE IF NOT EXISTS god_algorithm_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalization_divisor NUMERIC(5,2) NOT NULL DEFAULT 19.0,
  base_boost_minimum    NUMERIC(4,2) NOT NULL DEFAULT 2.8,
  vibe_bonus_cap        NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  component_weights     JSONB NOT NULL DEFAULT '{"team":3.0,"traction":3.0,"market":2.0,"product":2.0,"vision":2.0,"ecosystem":1.5,"grit":1.5,"problemValidation":2.0}'::jsonb,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  applied_from_rec_id   UUID,
  applied_by            TEXT NOT NULL DEFAULT 'system',
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_god_config_active ON god_algorithm_config(is_active, created_at DESC);

INSERT INTO god_algorithm_config (normalization_divisor, base_boost_minimum, vibe_bonus_cap, applied_by, description)
SELECT 19.0, 2.8, 1.0, 'system', 'Production baseline calibrated Feb 20 2026'
WHERE NOT EXISTS (SELECT 1 FROM god_algorithm_config LIMIT 1);

CREATE OR REPLACE FUNCTION startup_auto_approve()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.status = 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_startup_auto_approve ON startup_uploads;

CREATE TRIGGER trg_startup_auto_approve
  BEFORE INSERT OR UPDATE OF status
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION startup_auto_approve();
`;

// Try the Supabase admin API
const fetch = require('node-fetch') || require('cross-fetch');

async function run() {
  // Method 1: Try /rest/v1/rpc/exec_sql
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(url, key);
    const { data, error } = await sb.rpc('exec_sql', { sql });
    if (!error) {
      console.log('Method 1 (exec_sql RPC) succeeded:', data);
      return;
    }
    console.log('Method 1 failed:', error.message);
  } catch (e) {
    console.log('Method 1 exception:', e.message);
  }

  // Method 2: Supabase management API (needs management token, not service role)
  console.log('Cannot create table via API without management token or postgres URL');
  console.log('');
  console.log('MANUAL STEP REQUIRED:');
  console.log('Go to https://supabase.com/dashboard/project/' + projectRef + '/sql');
  console.log('And run the SQL in supabase/migrations/20260220_ml_pipeline_and_auto_approve.sql');
  process.exit(0);
}

run();
