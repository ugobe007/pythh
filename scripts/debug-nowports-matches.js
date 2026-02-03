#!/usr/bin/env node
/**
 * Debug Nowports matches issue
 * Check if Nowports exists and has matches in database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('🔍 Debugging Nowports matches...\n');
  
  // 1. Find Nowports startup
  console.log('1. Looking for Nowports in startup_uploads...');
  const { data: startups, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, website, status, total_god_score')
    .ilike('name', '%nowport%')
    .limit(5);
  
  if (startupError) {
    console.error('   ❌ Error:', startupError);
    return;
  }
  
  if (!startups || startups.length === 0) {
    console.log('   ⚠️  No startups found matching "nowport"');
    return;
  }
  
  console.log(`   ✅ Found ${startups.length} startup(s):`);
  startups.forEach(s => {
    console.log(`      - ${s.name} (${s.id})`);
    console.log(`        Website: ${s.website}`);
    console.log(`        Status: ${s.status}`);
    console.log(`        GOD Score: ${s.total_god_score}`);
  });
  
  const nowports = startups[0];
  console.log(`\n2. Checking matches for ${nowports.name} (${nowports.id})...`);
  
  // 2. Check raw matches table
  const { data: rawMatches, error: matchError } = await supabase
    .from('startup_investor_matches')
    .select('investor_id, match_score, reasoning')
    .eq('startup_id', nowports.id)
    .order('match_score', { ascending: false })
    .limit(10);
  
  if (matchError) {
    console.error('   ❌ Error:', matchError);
    return;
  }
  
  console.log(`   ✅ Found ${rawMatches?.length || 0} raw matches`);
  if (rawMatches && rawMatches.length > 0) {
    rawMatches.slice(0, 3).forEach((m, i) => {
      console.log(`      ${i + 1}. Score: ${m.match_score} - ${m.reasoning?.slice(0, 60)}...`);
    });
  }
  
  // 3. Try the RPC function
  console.log(`\n3. Testing get_live_match_table RPC...`);
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_live_match_table', {
    p_startup_id: nowports.id,
    p_limit_unlocked: 5,
    p_limit_locked: 50
  });
  
  if (rpcError) {
    console.error('   ❌ RPC Error:', rpcError);
    return;
  }
  
  console.log(`   ✅ RPC returned ${rpcData?.length || 0} rows`);
  if (rpcData && rpcData.length > 0) {
    rpcData.slice(0, 5).forEach((r, i) => {
      console.log(`      ${i + 1}. ${r.investor_name || 'Locked'} - Signal: ${r.signal_score}, Locked: ${r.is_locked}`);
    });
  } else {
    console.log('   ⚠️  RPC returned no rows - this is the problem!');
  }
  
  // 4. Check if matches meet threshold
  console.log(`\n4. Checking match score threshold...`);
  const { data: thresholdMatches } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .eq('startup_id', nowports.id)
    .gte('match_score', 50)
    .limit(1);
  
  if (thresholdMatches && thresholdMatches.length > 0) {
    console.log(`   ✅ Matches above threshold (>= 50) exist`);
  } else {
    console.log(`   ❌ No matches >= 50 (RPC filters for match_score >= 50)`);
    
    // Show highest score
    const { data: highest } = await supabase
      .from('startup_investor_matches')
      .select('match_score')
      .eq('startup_id', nowports.id)
      .order('match_score', { ascending: false })
      .limit(1);
    
    if (highest && highest.length > 0) {
      console.log(`      Highest match score: ${highest[0].match_score}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('- Startup exists: ✅');
  console.log(`- GOD Score: ${nowports.total_god_score}`);
  console.log(`- Raw matches: ${rawMatches?.length || 0}`);
  console.log(`- RPC matches: ${rpcData?.length || 0}`);
  
  if (!rpcData || rpcData.length === 0) {
    console.log('\n💡 Solution: Run match regeneration for this startup');
    console.log('   Command: node match-regenerator.js');
  }
}

debug().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
