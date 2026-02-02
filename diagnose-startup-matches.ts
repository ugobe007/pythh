/**
 * Diagnose why a specific startup has no matches
 * Usage: npx tsx diagnose-startup-matches.ts <startup_id>
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const startupId = process.argv[2] || '697d7775-8c3c-43a9-9b3b-927cf99d88cb';

async function diagnose() {
  console.log(`\n🔍 Diagnosing startup: ${startupId}\n`);

  // 1. Check if startup exists
  const { data: startup, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, status, total_god_score, created_at')
    .eq('id', startupId)
    .single();

  if (startupError || !startup) {
    console.log('❌ STARTUP NOT FOUND');
    console.log('   Error:', startupError?.message || 'No record with this ID');
    return;
  }

  console.log('✅ Startup exists:');
  console.log(`   Name: ${startup.name}`);
  console.log(`   Status: ${startup.status}`);
  console.log(`   GOD Score: ${startup.total_god_score || 'NOT SET'}`);
  console.log(`   Created: ${new Date(startup.created_at).toLocaleString()}`);

  // 2. Check for matches
  const { data: matches, error: matchError, count } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact' })
    .eq('startup_id', startupId);

  console.log(`\n📊 Match Analysis:`);
  
  if (matchError) {
    console.log('❌ Error fetching matches:', matchError.message);
    return;
  }

  console.log(`   Total matches: ${count || 0}`);

  if (!count || count === 0) {
    console.log('\n🚨 PROBLEM: No matches generated for this startup\n');
    console.log('Possible reasons:');
    console.log('1. Matching job hasn\'t run yet (new startup)');
    console.log('2. GOD score not calculated yet');
    console.log('3. No investors match the startup\'s sectors/stage');
    console.log('4. Startup status not "approved" (matching only runs on approved)');
    
    // Check total investors for comparison
    const { count: investorCount } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Context:`);
    console.log(`   Total investors in system: ${investorCount}`);
    console.log(`   Expected matches: 50-500 (depending on sector overlap)`);
    
    return;
  }

  // 3. Analyze match quality
  const statusBreakdown: Record<string, number> = {};
  let suggestedCount = 0;
  let highQualityCount = 0;
  let avgScore = 0;

  matches?.forEach(m => {
    const status = m.status || 'suggested';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    if (status === 'suggested') suggestedCount++;
    if (m.match_score >= 70) highQualityCount++;
    avgScore += m.match_score || 0;
  });

  avgScore = avgScore / (count || 1);

  console.log(`   Average match score: ${avgScore.toFixed(1)}/100`);
  console.log(`   High quality (70+): ${highQualityCount}`);
  console.log(`   Status: "suggested": ${suggestedCount}`);

  console.log(`\n📋 Status breakdown:`);
  Object.entries(statusBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

  // 4. Sample top matches
  const topMatches = matches
    ?.sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 5);

  console.log(`\n🎯 Top 5 matches:`);
  
  for (const match of topMatches || []) {
    const { data: investor } = await supabase
      .from('investors')
      .select('name, firm')
      .eq('id', match.investor_id)
      .single();
    
    console.log(`   ${Math.round(match.match_score)}% - ${investor?.name} (${investor?.firm || 'N/A'})`);
  }

  // 5. Final diagnosis
  console.log(`\n💡 DIAGNOSIS:\n`);
  
  if (count < 20) {
    console.log('⚠️  Too few matches (< 20)');
    console.log('   This is unusual. Most startups should have 50+ matches.');
    console.log('   Possible causes:');
    console.log('   - Very niche sector with few investors');
    console.log('   - Matching algorithm filtered out most investors');
    console.log('   - Need to run match regeneration');
  } else if (suggestedCount < 20) {
    console.log('⚠️  Not enough "suggested" status matches');
    console.log(`   Total matches: ${count}, but only ${suggestedCount} are "suggested"`);
    console.log('   The UI filters for status="suggested" by default');
  } else {
    console.log('✅ Matches look good!');
    console.log(`   ${count} total, ${suggestedCount} suggested, avg ${avgScore.toFixed(1)}%`);
    console.log('   The "no matches" error might be a UI/query issue.');
  }

  console.log('\n🔧 Suggested actions:');
  if (!startup.total_god_score || startup.total_god_score < 1) {
    console.log('1. Calculate GOD score: npx tsx scripts/recalculate-scores.ts');
  }
  if (count === 0) {
    console.log('2. Generate matches: node match-regenerator.js');
  }
  if (startup.status !== 'approved') {
    console.log(`3. Approve startup: Currently "${startup.status}", needs to be "approved"`);
  }
  
  console.log('\n');
}

diagnose().catch(console.error);
