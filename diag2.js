require('dotenv').config({ path: '/Users/leguplabs/Desktop/hot-honey/.env' });
const { createClient } = require('@supabase/supabase-js');

const PROD_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNTkwMzUsImV4cCI6MjA3NjczNTAzNX0.DdtBUf-liELSfKs2akrrHMcmlX4vHEkTuytWnvAYpJ8";
const URL = "https://unkpogyhhjbvxxjvmxlt.supabase.co";

// Use the exact same anon key baked into the production bundle
const sb = createClient(URL, PROD_ANON_KEY);

(async () => {
  console.log('=== Exact production browser scenario ===');
  console.log('(anon key from fly.toml, same as what browser uses)\n');

  // PythhMain passes hoursAgo=720 → cascade: [720, 5040, 168]
  for (const tryHours of [720, 5040, 168]) {
    const { data, error } = await sb.rpc('get_hot_matches', { limit_count: 5, hours_ago: tryHours });
    console.log(`hours_ago=${tryHours}: rows=${data?.length ?? 'null'} | error=${error?.message || 'none'}`);
    if (data && data.length > 0) {
      console.log('  → WOULD BREAK HERE, using these results');
      console.log('  sample:', JSON.stringify(data[0]));
      break;
    }
  }

  console.log('\n--- velocity ---');
  const { data: v, error: ve } = await sb.rpc('get_platform_velocity');
  console.log(`velocity: rows=${v?.length} | error=${ve?.message || 'none'}`);
  if (v?.[0]) console.log('data:', JSON.stringify(v[0]));

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
