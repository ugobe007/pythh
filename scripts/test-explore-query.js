require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const c = createClient(
  'https://unkpogyhhjbvxxjvmxlt.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  // Test 1: Full query (exact same as startupSearchService.ts)
  console.log('=== Test 1: Full query with all columns ===');
  const { data: d1, error: e1, count: c1 } = await c
    .from('startup_uploads')
    .select('id, name, tagline, description, sectors, stage, location, total_god_score, team_score, traction_score, market_score, product_score, vision_score, website, raise_type, created_at, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon, is_competitive, is_bridge_round, has_sector_pivot, has_social_proof_cascade, is_repeat_founder, has_cofounder_exit', { count: 'exact' })
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(3);
  console.log('ERROR:', e1 ? JSON.stringify(e1) : 'none');
  console.log('COUNT:', c1);
  console.log('ROWS:', d1 ? d1.length : 0);

  // Test 2: Minimal query (just core columns)
  console.log('\n=== Test 2: Minimal query ===');
  const { data: d2, error: e2, count: c2 } = await c
    .from('startup_uploads')
    .select('id, name, total_god_score', { count: 'exact' })
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(3);
  console.log('ERROR:', e2 ? JSON.stringify(e2) : 'none');
  console.log('COUNT:', c2);
  console.log('ROWS:', d2 ? d2.length : 0);

  // Test 3: Check which psychological columns exist
  console.log('\n=== Test 3: Psychological columns ===');
  const psychCols = ['enhanced_god_score', 'psychological_multiplier', 'is_oversubscribed', 'has_followon', 'is_competitive', 'is_bridge_round', 'has_sector_pivot', 'has_social_proof_cascade', 'is_repeat_founder', 'has_cofounder_exit'];
  for (const col of psychCols) {
    const { error } = await c
      .from('startup_uploads')
      .select(col)
      .limit(1);
    console.log(`  ${col}: ${error ? '❌ ' + error.message : '✅'}`);
  }
}

test().catch(console.error);
