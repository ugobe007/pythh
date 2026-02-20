require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);
async function run() {
  const { data, error } = await sb.from('god_algorithm_config').select('*').limit(1);
  console.log('god_algorithm_config exists:', !error);
  if (error) console.log('error:', error.message);
  if (data) console.log('data:', JSON.stringify(data));
  process.exit(0);
}
run();
