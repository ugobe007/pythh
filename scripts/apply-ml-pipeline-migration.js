// Apply ML pipeline and auto-approve migration
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log('Applying migration: ml_pipeline_and_auto_approve');

  // 1. Create god_algorithm_config table
  const { error: e1 } = await sb.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS god_algorithm_config (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        normalization_divisor NUMERIC(5,2) NOT NULL DEFAULT 19.0,
        base_boost_minimum    NUMERIC(4,2) NOT NULL DEFAULT 2.8,
        vibe_bonus_cap        NUMERIC(4,2) NOT NULL DEFAULT 1.0,
        component_weights     JSONB NOT NULL DEFAULT '{"team":3.0,"traction":3.0,"market":2.0,"product":2.0,"vision":2.0,"ecosystem":1.5,"grit":1.5,"problemValidation":2.0}',
        is_active             BOOLEAN NOT NULL DEFAULT true,
        applied_from_rec_id   UUID,
        applied_by            TEXT NOT NULL DEFAULT 'system',
        description           TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
  });
  if (e1) console.log('Table create:', e1.message);
  else console.log('✅ god_algorithm_config table created');

  // 2. Seed baseline config
  const { error: e2 } = await sb.from('god_algorithm_config').insert({
    normalization_divisor: 19.0,
    base_boost_minimum: 2.8,
    vibe_bonus_cap: 1.0,
    applied_by: 'system',
    description: 'Production baseline — calibrated Feb 20, 2026'
  });
  if (e2) console.log('Seed config:', e2.message);
  else console.log('✅ Baseline config seeded');

  // 3. Bulk approve pending
  const { data: approved, error: e3 } = await sb
    .from('startup_uploads')
    .update({ status: 'approved' })
    .eq('status', 'pending')
    .select('id');
  if (e3) console.log('Bulk approve error:', e3.message);
  else console.log(`✅ Bulk-approved ${approved?.length || 0} pending startups`);

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
