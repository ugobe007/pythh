#!/usr/bin/env node
/**
 * Emergency floor enforcement — set all approved startups below 40 to 40.
 * Also fixes enhanced_god_score.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔧 Enforcing 40-point floor on all approved startups...\n');

  // Fix total_god_score
  const { data: belowFloor, error: e1 } = await sb
    .from('startup_uploads')
    .update({ total_god_score: 40 })
    .eq('status', 'approved')
    .lt('total_god_score', 40)
    .not('total_god_score', 'is', null)
    .select('id');

  if (e1) {
    console.error('Error fixing total_god_score:', e1.message);
  } else {
    console.log(`  Fixed total_god_score: ${(belowFloor || []).length} rows raised to 40`);
  }

  // Fix enhanced_god_score
  const { data: belowFloorEnh, error: e2 } = await sb
    .from('startup_uploads')
    .update({ enhanced_god_score: 40 })
    .eq('status', 'approved')
    .lt('enhanced_god_score', 40)
    .not('enhanced_god_score', 'is', null)
    .select('id');

  if (e2) {
    console.error('Error fixing enhanced_god_score:', e2.message);
  } else {
    console.log(`  Fixed enhanced_god_score: ${(belowFloorEnh || []).length} rows raised to 40`);
  }

  // Verify
  const { count } = await sb
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .lt('total_god_score', 40);

  console.log(`\n  Remaining below 40: ${count}`);
  console.log(count === 0 ? '  ✅ Floor fully enforced' : '  ⚠️  Still have violations');
})();
