const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔍 Verifying migrations...\n');
  
  // Check table exists
  const { data: table, error: tableErr } = await supabase
    .from('match_runs')
    .select('*', { count: 'exact', head: true });
  
  console.log('✓ match_runs table:', tableErr ? `MISSING (${tableErr.message})` : 'EXISTS');
  
  // Check RPCs exist
  const rpcs = [
    'start_match_run',
    'get_match_run',
    'claim_next_match_run',
    'complete_match_run',
    'get_match_run_debug'
  ];
  
  console.log('\n✓ Checking RPCs:');
  for (const rpc of rpcs) {
    const { error } = await supabase.rpc(rpc, {}).catch(e => ({ error: e }));
    const exists = !error || error?.message?.includes('invalid input') || error?.message?.includes('null value');
    console.log(`  - ${rpc}:`, exists ? '✓' : `✗ (${error?.message?.slice(0, 50)})`);
  }
  
  console.log('\n✅ Migration verification complete');
})();
