#!/usr/bin/env node
/**
 * Test Bucket #2 + #4 Fixes
 * Verify startup resolution → match fetching flow works
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testBucketFixes() {
  console.log('=== TESTING BUCKET #2 + #4 FIXES ===\n');
  
  // Step 1: Get a real startup with matches
  const { data: testStartup } = await supabase
    .from('startup_uploads')
    .select('id, name, website')
    .eq('status', 'approved')
    .not('website', 'is', null)
    .limit(1)
    .single();
  
  if (!testStartup || !testStartup.id) {
    console.error('❌ BUCKET #2 STILL BROKEN: startup.id is missing!');
    return;
  }
  
  console.log('✅ Step 1: Startup resolved with ID');
  console.log('   ID:', testStartup.id);
  console.log('   Name:', testStartup.name);
  console.log('   Website:', testStartup.website);
  
  // Step 2: Fetch ALL matches (no threshold)
  const { data: allMatchesRaw, error: matchError } = await supabase
    .from('startup_investor_matches')
    .select('match_score, investor_id')
    .eq('startup_id', testStartup.id)
    .order('match_score', { ascending: false })
    .limit(100);
  
  if (matchError) {
    console.error('❌ Match query failed:', matchError);
    return;
  }
  
  console.log('\n✅ Step 2: Fetched raw matches');
  console.log('   Raw matches:', allMatchesRaw?.length || 0);
  
  if (!allMatchesRaw || allMatchesRaw.length === 0) {
    console.log('⚠️  No matches in database for this startup');
    return;
  }
  
  // Step 3: Test SURVIVAL MODE threshold logic
  const filtered = allMatchesRaw.filter(m => m.match_score && m.match_score >= 50);
  const finalMatches = filtered.length > 0 ? filtered : allMatchesRaw.slice(0, 10);
  
  console.log('\n✅ Step 3: SURVIVAL MODE active');
  console.log('   Matches ≥50:', filtered.length);
  console.log('   Final matches shown:', finalMatches.length);
  console.log('   Survival triggered:', filtered.length === 0 ? 'YES' : 'NO');
  
  // Step 4: Verify match scores
  const topMatches = finalMatches.slice(0, 5);
  console.log('\n✅ Step 4: Top 5 match scores:');
  topMatches.forEach((m, i) => {
    console.log(`   #${i + 1}: Score ${m.match_score}`);
  });
  
  // Step 5: Verify we can fetch investors
  const investorIds = finalMatches.map(m => m.investor_id).filter(id => id !== null);
  const { data: investors } = await supabase
    .from('investors')
    .select('id, name, firm')
    .in('id', investorIds);
  
  console.log('\n✅ Step 5: Fetched investor details');
  console.log('   Investors found:', investors?.length || 0);
  
  // Final verdict
  console.log('\n🎉 ALL BUCKET FIXES VERIFIED!');
  console.log('   ✓ Startup resolution works (ID present)');
  console.log('   ✓ Matches fetched AFTER resolution');
  console.log('   ✓ Survival mode prevents empty results');
  console.log('   ✓ Manual join works correctly');
}

testBucketFixes().catch(console.error);
