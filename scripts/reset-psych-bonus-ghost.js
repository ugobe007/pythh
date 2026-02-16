// One-off: Reset ghost psychological_bonus column (legacy 1.0 multiplier artifacts)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function resetBatch() {
  const { data, error } = await sb.from('startup_uploads')
    .select('id')
    .neq('psychological_bonus', 0)
    .limit(500);
  if (error) { console.log('ERR:', error.message); return 0; }
  if (!data || data.length === 0) return 0;
  const ids = data.map(d => d.id);
  const { error: upErr } = await sb.from('startup_uploads')
    .update({ psychological_bonus: 0 })
    .in('id', ids);
  if (upErr) { console.log('Update ERR:', upErr.message); return 0; }
  console.log('  Reset batch:', ids.length);
  return ids.length;
}

(async () => {
  let total = 0;
  let batch;
  do {
    batch = await resetBatch();
    total += batch;
  } while (batch > 0);
  console.log('Done. Total reset:', total);
})();
