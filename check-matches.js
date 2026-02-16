require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkMatches() {
  console.log('=== MATCH QUALITY AUDIT ===\n');

  // 1. Total match count
  const { count: totalMatches } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });
  console.log('Total matches:', totalMatches);

  // 2. Match score distribution
  const { data: allMatches } = await supabase
    .from('startup_investor_matches')
    .select('match_score, match_type, startup_id, investor_id');

  if (!allMatches || allMatches.length === 0) {
    console.log('No matches found');
    return;
  }

  const scores = allMatches.map(m => m.match_score).filter(s => s != null);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const buckets = {
    '0-19': scores.filter(s => s >= 0 && s < 20).length,
    '20-39': scores.filter(s => s >= 20 && s < 40).length,
    '40-59': scores.filter(s => s >= 40 && s < 60).length,
    '60-79': scores.filter(s => s >= 60 && s < 80).length,
    '80-100': scores.filter(s => s >= 80).length,
  };

  console.log('\nMatch Score Distribution:');
  console.log('  Avg:', avg.toFixed(1), '| Min:', min, '| Max:', max);
  for (const [range, count] of Object.entries(buckets)) {
    const pct = ((count / scores.length) * 100).toFixed(1);
    const bar = '#'.repeat(Math.round(count / Math.max(1, scores.length / 50)));
    console.log('  ' + range + ': ' + count + ' (' + pct + '%) ' + bar);
  }

  // 3. Match types breakdown
  const typeCount = {};
  allMatches.forEach(m => {
    const t = m.match_type || 'unknown';
    typeCount[t] = (typeCount[t] || 0) + 1;
  });
  console.log('\nMatch Types:');
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + type + ': ' + count);
  }

  // 4. Unique startups and investors in matches
  const uniqueStartups = new Set(allMatches.map(m => m.startup_id));
  const uniqueInvestors = new Set(allMatches.map(m => m.investor_id));
  console.log('\nCoverage:');
  console.log('  Unique startups matched:', uniqueStartups.size);
  console.log('  Unique investors matched:', uniqueInvestors.size);

  // 5. Check approved startups count
  const { count: approvedCount } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  console.log('  Total approved startups:', approvedCount);

  // 6. Check investor count
  const { count: investorCount } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  console.log('  Total investors:', investorCount);

  // 7. Coverage percentages
  const startupCoverage = ((uniqueStartups.size / approvedCount) * 100).toFixed(1);
  const investorCoverage = ((uniqueInvestors.size / investorCount) * 100).toFixed(1);
  console.log('  Startup coverage:', startupCoverage + '%');
  console.log('  Investor coverage:', investorCoverage + '%');

  // 8. Matches per investor stats
  const matchesPerInvestor = {};
  allMatches.forEach(m => {
    matchesPerInvestor[m.investor_id] = (matchesPerInvestor[m.investor_id] || 0) + 1;
  });
  const investorMatchCounts = Object.values(matchesPerInvestor);
  const avgMPI = investorMatchCounts.reduce((a, b) => a + b, 0) / investorMatchCounts.length;
  const maxMPI = Math.max(...investorMatchCounts);
  const minMPI = Math.min(...investorMatchCounts);
  console.log('\nMatches per Investor:');
  console.log('  Avg:', avgMPI.toFixed(1), '| Min:', minMPI, '| Max:', maxMPI);

  // 9. Matches per startup stats
  const matchesPerStartup = {};
  allMatches.forEach(m => {
    matchesPerStartup[m.startup_id] = (matchesPerStartup[m.startup_id] || 0) + 1;
  });
  const startupMatchCounts = Object.values(matchesPerStartup);
  const avgMPS = startupMatchCounts.reduce((a, b) => a + b, 0) / startupMatchCounts.length;
  const maxMPS = Math.max(...startupMatchCounts);
  const minMPS = Math.min(...startupMatchCounts);
  console.log('\nMatches per Startup:');
  console.log('  Avg:', avgMPS.toFixed(1), '| Min:', minMPS, '| Max:', maxMPS);

  // 10. Recent matches (data freshness)
  const { data: recentMatches } = await supabase
    .from('startup_investor_matches')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (recentMatches && recentMatches.length > 0) {
    const lastMatch = new Date(recentMatches[0].created_at);
    const hoursAgo = ((Date.now() - lastMatch.getTime()) / (1000 * 60 * 60)).toFixed(1);
    console.log('\nData Freshness:');
    console.log('  Last match created:', lastMatch.toISOString(), '(' + hoursAgo + 'h ago)');
  }

  // 11. Sample top matches with names
  const { data: topMatches } = await supabase
    .from('startup_investor_matches')
    .select('match_score, startup_id, investor_id, match_type')
    .order('match_score', { ascending: false })
    .limit(10);

  if (topMatches && topMatches.length > 0) {
    const startupIds = topMatches.map(m => m.startup_id);
    const investorIds = topMatches.map(m => m.investor_id);
    
    const { data: startups } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score')
      .in('id', startupIds);
    
    const { data: investors } = await supabase
      .from('investors')
      .select('id, name')
      .in('id', investorIds);
    
    const startupMap = {};
    const investorMap = {};
    (startups || []).forEach(s => { startupMap[s.id] = s; });
    (investors || []).forEach(i => { investorMap[i.id] = i; });

    console.log('\nTop 10 Matches:');
    topMatches.forEach((m, i) => {
      const s = startupMap[m.startup_id] || {};
      const inv = investorMap[m.investor_id] || {};
      const sName = (s.name || 'Unknown').substring(0, 30);
      const iName = (inv.name || 'Unknown').substring(0, 25);
      console.log('  ' + (i+1) + '. ' + sName + ' (GOD:' + (s.total_god_score||'?') + ') <-> ' + iName + ' | match:' + m.match_score + ' type:' + (m.match_type || '-'));
    });
  }

  // 12. Sample low-quality matches
  const { data: bottomMatches } = await supabase
    .from('startup_investor_matches')
    .select('match_score, startup_id, investor_id, match_type')
    .order('match_score', { ascending: true })
    .limit(5);

  if (bottomMatches && bottomMatches.length > 0) {
    console.log('\nBottom 5 Matches (lowest scores):');
    const sIds = bottomMatches.map(m => m.startup_id);
    const iIds = bottomMatches.map(m => m.investor_id);
    const { data: s2 } = await supabase.from('startup_uploads').select('id, name, total_god_score').in('id', sIds);
    const { data: i2 } = await supabase.from('investors').select('id, name').in('id', iIds);
    const sm2 = {}; const im2 = {};
    (s2||[]).forEach(s => sm2[s.id] = s);
    (i2||[]).forEach(i => im2[i.id] = i);
    bottomMatches.forEach((m, idx) => {
      const s = sm2[m.startup_id] || {};
      const inv = im2[m.investor_id] || {};
      console.log('  ' + (idx+1) + '. ' + (s.name||'?').substring(0,30) + ' (GOD:' + (s.total_god_score||'?') + ') <-> ' + (inv.name||'?').substring(0,25) + ' | match:' + m.match_score);
    });
  }

  // Guardian thresholds
  console.log('\n=== GUARDIAN THRESHOLDS ===');
  console.log('  Match count > 5,000:', totalMatches > 5000 ? 'PASS' : 'FAIL', '(' + totalMatches + ')');
  console.log('  Avg match score 40-80:', avg >= 40 && avg <= 80 ? 'PASS' : 'WARN', '(' + avg.toFixed(1) + ')');
  console.log('  Startup coverage > 50%:', parseFloat(startupCoverage) > 50 ? 'PASS' : 'WARN', '(' + startupCoverage + '%)');
  console.log('  Investor coverage > 80%:', parseFloat(investorCoverage) > 80 ? 'PASS' : 'WARN', '(' + investorCoverage + '%)');
}

checkMatches().catch(console.error);
