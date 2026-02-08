#!/usr/bin/env node
require('dotenv').config();
const { supabase } = require('../server/lib/supabaseClient');

(async () => {
  // Find a startup with >50 matches
  const { data: heavyRows } = await supabase
    .from('startup_investor_matches')
    .select('startup_id, count')
    .limit(1);

  // Use known over-50 startup from SQL: 00cf9fed-4b75-45e9-90c4-d847c145f940
  // (had 108, we pruned 58 in SQL editor, so now 50)
  // Let's find one still >50
  const testId = '50bbb6f4-b987-494f-a0d4-38d188871bc5'; // Drata, 813 matches
  
  // Count matches for this startup
  const { count, error: countErr } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', testId);
  console.log(`Startup ${testId}: ${count} matches (err: ${countErr?.message || 'none'})`);

  // Check if in startup_uploads
  const { data: upData } = await supabase
    .from('startup_uploads')
    .select('id, name')
    .eq('id', testId)
    .single();
  console.log('In startup_uploads:', upData ? 'YES - ' + upData.name : 'NO');

  // Call prune RPC
  const { data, error } = await supabase.rpc('prune_one_startup', {
    p_startup_id: testId,
    p_top_n: 50
  });
  console.log('RPC result:', data, 'type:', typeof data, 'error:', error?.message || 'none');

  // Count again
  const { count: count2 } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', testId);
  console.log(`After prune: ${count2} matches`);

  process.exit(0);
})();
