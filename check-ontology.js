const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // 1. Entity ontologies table stats
  const { count: totalEntities } = await supabase.from('entity_ontologies').select('*', { count: 'exact', head: true });
  console.log('\n=== ENTITY ONTOLOGIES ===');
  console.log('Total entities:', totalEntities);

  const { data: allEntities } = await supabase.from('entity_ontologies').select('entity_type, confidence').limit(5000);
  if (allEntities) {
    const types = {};
    allEntities.forEach(e => { types[e.entity_type] = (types[e.entity_type] || 0) + 1; });
    console.log('By type:', JSON.stringify(types));
    const highConf = allEntities.filter(e => e.confidence >= 0.85).length;
    const medConf = allEntities.filter(e => e.confidence >= 0.5 && e.confidence < 0.85).length;
    const lowConf = allEntities.filter(e => e.confidence < 0.5).length;
    console.log('Confidence: high(>=0.85)=' + highConf + ', med(0.5-0.84)=' + medConf + ', low(<0.5)=' + lowConf);
  }

  // 2. Recent ontology additions
  const { data: recent } = await supabase.from('entity_ontologies')
    .select('entity_name, entity_type, confidence, source, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nRecent ontology entries:');
  (recent || []).forEach(r => {
    const date = r.created_at ? r.created_at.substring(0, 10) : '?';
    console.log('  ' + date + ' | ' + r.entity_type.padEnd(10) + ' | ' + r.confidence + ' | ' + r.entity_name + ' (' + r.source + ')');
  });

  // 3. Discovered startups stats
  const { count: totalDiscovered } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true });
  const { count: importedCount } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true }).eq('imported_to_startups', true);
  const { data: recentDiscoveries } = await supabase.from('discovered_startups')
    .select('name, rss_source, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(10);
  console.log('\n=== DISCOVERED STARTUPS ===');
  console.log('Total: ' + totalDiscovered + ' | Imported: ' + importedCount);
  console.log('Latest discoveries:');
  (recentDiscoveries || []).forEach(d => {
    const ts = d.discovered_at ? d.discovered_at.substring(0, 16) : '?';
    console.log('  ' + ts + ' | ' + (d.name || 'NO NAME').substring(0, 30).padEnd(30) + ' | ' + (d.rss_source || '?'));
  });

  // 4. RSS source health
  const { data: sources } = await supabase.from('rss_sources')
    .select('name, active, last_scraped, total_discoveries, consecutive_failures, avg_yield_per_scrape')
    .order('total_discoveries', { ascending: false })
    .limit(15);
  console.log('\n=== RSS SOURCE HEALTH ===');
  (sources || []).forEach(s => {
    const status = s.consecutive_failures > 3 ? 'FAIL' : s.active ? 'OK' : 'OFF';
    const lastScrape = s.last_scraped ? s.last_scraped.substring(0, 10) : 'never';
    console.log('  [' + status + '] ' + (s.name || '?').substring(0, 25).padEnd(25) + ' | disc: ' + String(s.total_discoveries || 0).padStart(5) + ' | fails: ' + (s.consecutive_failures || 0) + ' | yield: ' + (s.avg_yield_per_scrape || 0).toFixed(1) + ' | last: ' + lastScrape);
  });

  // 5. AI logs recent activity
  const { data: aiLogs } = await supabase.from('ai_logs')
    .select('operation, status, created_at, input_tokens, output_tokens')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\n=== AI LOGS (RECENT) ===');
  (aiLogs || []).forEach(l => {
    const ts = l.created_at ? l.created_at.substring(0, 16) : '?';
    console.log('  ' + ts + ' | ' + (l.operation || '?').padEnd(25) + ' | ' + l.status + ' | tokens: ' + ((l.input_tokens || 0) + (l.output_tokens || 0)));
  });

  // 6. Match quality check
  const { count: matchCount } = await supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  const { data: matchSample } = await supabase.from('startup_investor_matches')
    .select('match_score')
    .order('match_score', { ascending: false })
    .limit(100);
  const mscores = (matchSample || []).map(m => m.match_score);
  const avgTop100 = mscores.length > 0 ? (mscores.reduce((a, b) => a + b, 0) / mscores.length).toFixed(1) : 'N/A';
  console.log('\n=== MATCH QUALITY ===');
  console.log('Total matches: ' + matchCount + ' | Top 100 avg: ' + avgTop100 + ' | Max: ' + (mscores[0] || 'N/A') + ' | Min(top100): ' + (mscores[mscores.length - 1] || 'N/A'));

  // 7. Startup approval funnel
  const { count: approvedCount } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const { count: pendingCount } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: noScore } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved').is('total_god_score', null);
  console.log('\n=== STARTUP FUNNEL ===');
  console.log('Approved: ' + approvedCount + ' | Pending: ' + pendingCount + ' | Approved w/o GOD score: ' + noScore);

  // 8. Score distribution
  const { data: scoreDist } = await supabase.from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: true });
  if (scoreDist && scoreDist.length > 0) {
    const scores = scoreDist.map(s => s.total_god_score);
    const min = scores[0];
    const max = scores[scores.length - 1];
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const q1 = scores[Math.floor(scores.length * 0.25)];
    const median = scores[Math.floor(scores.length * 0.5)];
    const q3 = scores[Math.floor(scores.length * 0.75)];
    const iqr = q3 - q1;
    console.log('\n=== GOD SCORE DISTRIBUTION ===');
    console.log('Min: ' + min + ' | Q1: ' + q1 + ' | Median: ' + median + ' | Q3: ' + q3 + ' | Max: ' + max + ' | IQR: ' + iqr + ' | Avg: ' + avg);
    console.log('Count: ' + scores.length);
    const buckets = { '40-50': 0, '50-60': 0, '60-70': 0, '70-80': 0, '80-90': 0, '90-100': 0 };
    scores.forEach(s => {
      if (s < 50) buckets['40-50']++;
      else if (s < 60) buckets['50-60']++;
      else if (s < 70) buckets['60-70']++;
      else if (s < 80) buckets['70-80']++;
      else if (s < 90) buckets['80-90']++;
      else buckets['90-100']++;
    });
    console.log('Buckets:', JSON.stringify(buckets));
  }

  console.log('\nHealth check complete');
})();
