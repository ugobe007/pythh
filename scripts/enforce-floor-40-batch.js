#!/usr/bin/env node
/**
 * Enforce 40-point floor by updating startups one at a time.
 * Handles RLS/trigger issues by catching individual errors.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔧 Enforcing 40-point floor (batch mode)...\n');

  // Fetch ALL approved startups with score below 40 (paginate)
  let allBelow = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id, name, total_god_score')
      .eq('status', 'approved')
      .lt('total_god_score', 40)
      .not('total_god_score', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allBelow = allBelow.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`  Found ${allBelow.length} startups below 40\n`);

  let fixed = 0;
  let errors = 0;

  for (let i = 0; i < allBelow.length; i++) {
    const s = allBelow[i];
    const { error } = await sb
      .from('startup_uploads')
      .update({ total_god_score: 40, enhanced_god_score: Math.max(s.total_god_score || 40, 40) })
      .eq('id', s.id);

    if (error) {
      if (errors < 3) console.log(`  ⚠️ Error on ${s.name}: ${error.message}`);
      errors++;
    } else {
      fixed++;
    }
    
    if ((i + 1) % 200 === 0) {
      console.log(`  Progress: ${i + 1}/${allBelow.length} (${fixed} fixed, ${errors} errors)`);
    }
  }

  console.log(`\n  Fixed: ${fixed}`);
  console.log(`  Errors: ${errors}`);

  // Verify
  const { count } = await sb
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .lt('total_god_score', 40);

  console.log(`  Remaining below 40: ${count}`);
  console.log(count === 0 ? '  ✅ Floor fully enforced' : '  ⚠️  Still have violations');
})();
