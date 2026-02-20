// Check what tables exist for ML config
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);
async function run() {
  const tables = ['god_algorithm_config', 'algorithm_weight_history', 'ml_recommendations'];
  for (const t of tables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    console.log(t + ':', error ? 'MISSING - ' + error.message : 'EXISTS, rows=' + count);
  }
  // Check ml_recommendations columns
  const { data: sample } = await sb.from('ml_recommendations').select('*').limit(1);
  if (sample?.[0]) console.log('ml_recommendations columns:', Object.keys(sample[0]).join(', '));
  process.exit(0);
}
run();
