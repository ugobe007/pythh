/**
 * Test Match Engine Health
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== MATCH ENGINE HEALTH CHECK ===\n');

  // 1. Check counts
  const { count: matchCount } = await supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  const { count: startupCount } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const { count: investorCount } = await supabase.from('investors').select('*', { count: 'exact', head: true });
  
  console.log('📊 Database Counts:');
  console.log(`   Matches: ${matchCount?.toLocaleString()}`);
  console.log(`   Startups: ${startupCount?.toLocaleString()}`);
  console.log(`   Investors: ${investorCount?.toLocaleString()}\n`);

  // 2. Test resolve_startup_by_url
  console.log('🔍 Testing URL Resolution (nowports.com)...');
  const { data: resolved, error: resolveErr } = await supabase.rpc('resolve_startup_by_url', { p_url: 'nowports.com' });
  if (resolveErr) {
    console.log('   ❌ ERROR:', resolveErr.message);
  } else if (resolved) {
    console.log('   ✅ Resolved startup:', resolved.name || resolved.startup_name);
    console.log('   ID:', resolved.startup_id || resolved.id);
  } else {
    console.log('   ⚠️ No result returned');
  }

  // 3. Test get_live_match_table
  const testStartupId = resolved?.startup_id || resolved?.id;
  if (testStartupId) {
    console.log('\n📋 Testing get_live_match_table...');
    const { data: matches, error: matchErr } = await supabase.rpc('get_live_match_table', {
      p_startup_id: testStartupId,
      p_limit_unlocked: 5,
      p_limit_locked: 10
    });
    
    if (matchErr) {
      console.log('   ❌ ERROR:', matchErr.message);
    } else {
      console.log(`   ✅ Got ${matches?.length || 0} matches`);
      if (matches?.length > 0) {
        console.log('\n   Top 3 matches:');
        matches.slice(0, 3).forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.investor_name} (Signal: ${m.signal_score}, Fit: ${m.fit_bucket})`);
        });
      }
    }
  }

  // 4. Check signal scores
  console.log('\n📡 Checking Signal Scores...');
  const { count: signalCount } = await supabase.from('startup_signal_scores').select('*', { count: 'exact', head: true });
  console.log(`   Signal scores cached: ${signalCount?.toLocaleString()}`);

  // 5. Check recent match activity
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentMatches } = await supabase.from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', yesterday);
  console.log(`   Matches updated in last 24h: ${recentMatches?.toLocaleString()}`);

  console.log('\n=== END HEALTH CHECK ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
