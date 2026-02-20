// Bulk-approve all pending startups + seed god_algorithm_config baseline
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  // 1. Bulk-approve all pending startups
  const { data: approved, error: approveError } = await sb
    .from('startup_uploads')
    .update({ status: 'approved' })
    .eq('status', 'pending')
    .select('id, name');

  if (approveError) {
    console.error('Bulk-approve failed:', approveError.message);
  } else {
    console.log(`Bulk-approved ${approved?.length || 0} startups`);
    if (approved?.length > 0) {
      approved.slice(0, 5).forEach(s => console.log(' -', s.name));
      if (approved.length > 5) console.log(`  ... and ${approved.length - 5} more`);
    }
  }

  // 2. Seed god_algorithm_config with baseline if empty
  const { count: configCount } = await sb
    .from('god_algorithm_config')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (!configCount || configCount === 0) {
    const { error: seedError } = await sb.from('god_algorithm_config').insert({
      normalization_divisor: 19.0,
      base_boost_minimum: 2.8,
      vibe_bonus_cap: 1.0,
      is_active: true,
      applied_by: 'system',
      description: 'Production baseline — calibrated Feb 20, 2026'
    });
    if (seedError) console.error('Config seed failed:', seedError.message);
    else console.log('Seeded god_algorithm_config with baseline');
  } else {
    console.log('god_algorithm_config already has', configCount, 'active row(s)');
  }

  // 3. Verify final state
  const { count: stillPending } = await sb
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log('Remaining pending startups:', stillPending || 0);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
