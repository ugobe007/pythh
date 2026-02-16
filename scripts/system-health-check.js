#!/usr/bin/env node
// Health check: scraper stats, GOD scores, signal scoring
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  SYSTEM HEALTH CHECK — ' + new Date().toISOString().slice(0, 19));
  console.log('════════════════════════════════════════════════════════\n');

  // 1. Platform totals
  const { data: stats } = await supabase.rpc('get_platform_stats');
  console.log('📊 PLATFORM TOTALS');
  console.log('  Startups: ' + stats.startups);
  console.log('  Investors: ' + stats.investors);
  console.log('  Matches: ' + stats.matches);

  // 2. Scraper: discovered_startups recent pickups
  console.log('\n🕷️  SCRAPER — DISCOVERED STARTUPS');
  const { count: totalDiscovered } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true });
  console.log('  Total discovered: ' + totalDiscovered);

  // Last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: last24h } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
  console.log('  Last 24h: ' + last24h);

  // Last 48h
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { count: last48h } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true }).gte('created_at', twoDaysAgo);
  console.log('  Last 48h: ' + last48h);

  // Last 7d
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: last7d } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo);
  console.log('  Last 7d: ' + last7d);

  // 5 most recent discovered
  const { data: recentDiscovered } = await supabase.from('discovered_startups').select('name, source_url, created_at').order('created_at', { ascending: false }).limit(5);
  console.log('  Recent:');
  recentDiscovered?.forEach(d => console.log('    • ' + (d.name || 'unnamed') + ' (' + (d.created_at || '').slice(0, 16) + ')'));

  // 3. Startup uploads by status
  console.log('\n📦 STARTUP_UPLOADS BY STATUS');
  const statuses = ['pending', 'approved', 'published', 'rejected'];
  for (const st of statuses) {
    const { count } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', st);
    console.log('  ' + st + ': ' + count);
  }

  // New startups last 24h/48h/7d
  const { count: su24 } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
  const { count: su48 } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).gte('created_at', twoDaysAgo);
  const { count: su7d } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo);
  console.log('  New last 24h: ' + su24 + ' | 48h: ' + su48 + ' | 7d: ' + su7d);

  // 4. Investors added recently
  console.log('\n👤 INVESTORS');
  const { count: inv24 } = await supabase.from('investors').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
  const { count: inv48 } = await supabase.from('investors').select('*', { count: 'exact', head: true }).gte('created_at', twoDaysAgo);
  const { count: inv7d } = await supabase.from('investors').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo);
  console.log('  New last 24h: ' + inv24 + ' | 48h: ' + inv48 + ' | 7d: ' + inv7d);

  // 5. GOD Score Distribution
  console.log('\n🎯 GOD SCORE DISTRIBUTION (startup_uploads)');
  const { data: godScores } = await supabase.from('startup_uploads').select('total_god_score').not('total_god_score', 'is', null).limit(10000);
  if (godScores && godScores.length > 0) {
    const scores = godScores.map(s => s.total_god_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log('  Count: ' + scores.length + ' | Min: ' + Math.min(...scores) + ' | Max: ' + Math.max(...scores));
    console.log('  Avg: ' + avg.toFixed(1) + ' | Median: ' + median);
    
    const buckets = { '80+': 0, '70-79': 0, '60-69': 0, '50-59': 0, '40-49': 0, '<40': 0 };
    scores.forEach(s => {
      if (s >= 80) buckets['80+']++;
      else if (s >= 70) buckets['70-79']++;
      else if (s >= 60) buckets['60-69']++;
      else if (s >= 50) buckets['50-59']++;
      else if (s >= 40) buckets['40-49']++;
      else buckets['<40']++;
    });
    console.log('  Distribution:', JSON.stringify(buckets));
    
    // Check for floor-stuck startups (all at 40)
    const at40 = scores.filter(s => s === 40).length;
    const at41 = scores.filter(s => s >= 40 && s <= 41).length;
    console.log('  Stuck at exactly 40: ' + at40 + ' (' + (at40/scores.length*100).toFixed(1) + '%)');
    console.log('  At 40-41 range: ' + at41 + ' (' + (at41/scores.length*100).toFixed(1) + '%)');
  }

  // 6. Component scores check
  console.log('\n📐 COMPONENT SCORES (sample)');
  const { data: components } = await supabase.from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(10);
  console.log('  Top 10 by GOD score:');
  components?.forEach(c => {
    console.log('    ' + (c.name || '?').slice(0, 30).padEnd(32) + ' GOD:' + c.total_god_score + ' T:' + (c.team_score||'-') + ' Tr:' + (c.traction_score||'-') + ' M:' + (c.market_score||'-') + ' P:' + (c.product_score||'-') + ' V:' + (c.vision_score||'-'));
  });

  // 7. Signal scoring — signal_gaps
  console.log('\n📡 SIGNAL GAPS');
  const { count: totalGaps } = await supabase.from('signal_gaps').select('*', { count: 'exact', head: true });
  console.log('  Total signal gaps: ' + totalGaps);
  
  const { data: recentGaps } = await supabase.from('signal_gaps').select('startup_id, lens, dimension, gap_size, severity').order('created_at', { ascending: false }).limit(5);
  console.log('  Recent gaps:');
  recentGaps?.forEach(g => console.log('    • lens:' + g.lens + ' dim:' + g.dimension + ' gap:' + (g.gap_size||0).toFixed(2) + ' severity:' + g.severity));

  // 8. Score history / snapshots
  console.log('\n📈 SCORE HISTORY');
  const { count: snapshots } = await supabase.from('score_history').select('*', { count: 'exact', head: true });
  console.log('  Total score snapshots: ' + snapshots);
  const { count: recentSnaps } = await supabase.from('score_history').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
  console.log('  Last 24h snapshots: ' + recentSnaps);

  // 9. RSS sources health
  console.log('\n📰 RSS SOURCES');
  const { count: totalRss } = await supabase.from('rss_sources').select('*', { count: 'exact', head: true });
  const { count: activeRss } = await supabase.from('rss_sources').select('*', { count: 'exact', head: true }).eq('active', true);
  console.log('  Total: ' + totalRss + ' | Active: ' + activeRss);

  // 10. Matches health
  console.log('\n🔗 MATCHES');
  const { count: totalMatches } = await supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  console.log('  Total matches: ' + totalMatches);
  const { data: matchSample } = await supabase.from('startup_investor_matches').select('match_score').order('match_score', { ascending: false }).limit(1000);
  if (matchSample && matchSample.length > 0) {
    const ms = matchSample.map(m => m.match_score).filter(Boolean);
    if (ms.length > 0) {
      const mAvg = ms.reduce((a,b) => a+b, 0) / ms.length;
      console.log('  Top 1k match scores — Avg: ' + mAvg.toFixed(1) + ' | Max: ' + Math.max(...ms) + ' | Min: ' + Math.min(...ms));
    }
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  HEALTH CHECK COMPLETE');
  console.log('════════════════════════════════════════════════════════');
}

main().catch(console.error);
