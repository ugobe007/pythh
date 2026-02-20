// Platform status check: GOD scores, matches, ML recs, pending startups
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  // --- MATCH ENGINE ---
  const { count: total } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  const { count: high80 } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).gte('match_score', 80);
  const { count: high60 } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).gte('match_score', 60).lt('match_score', 80);
  const { data: topMatches } = await sb.from('startup_investor_matches').select('match_score').order('match_score', { ascending: false }).limit(5);

  console.log('=== MATCH ENGINE ===');
  console.log('Total matches:', total);
  console.log('High quality 80+:', high80, '(' + ((high80/total)*100).toFixed(1) + '%)');
  console.log('Mid quality 60-79:', high60, '(' + ((high60/total)*100).toFixed(1) + '%)');
  console.log('Top 5 scores:', topMatches.map(m => m.match_score).join(', '));

  // --- ML RECOMMENDATIONS ---
  const { data: recs, error: recErr } = await sb
    .from('ml_recommendations')
    .select('id, status, confidence, recommendation_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('');
  console.log('=== ML RECOMMENDATIONS ===');
  if (recErr) {
    console.log('ERROR:', recErr.message, '| Code:', recErr.code);
  } else if (!recs || recs.length === 0) {
    console.log('Table empty - no recommendations generated yet');
  } else {
    const byStatus = {};
    for (const r of recs) {
      const k = r.status || 'null';
      byStatus[k] = (byStatus[k] || 0) + 1;
    }
    console.log('Count by status:', JSON.stringify(byStatus));
    console.log('Newest record:');
    console.log('  id:', recs[0].id);
    console.log('  status:', recs[0].status);
    console.log('  confidence:', recs[0].confidence);
    console.log('  type:', recs[0].recommendation_type);
    console.log('  created:', recs[0].created_at);
  }

  // --- PENDING STARTUPS ---
  const { count: pendingCount } = await sb.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { data: pendingSample } = await sb
    .from('startup_uploads')
    .select('id, name, created_at, total_god_score')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(8);

  console.log('');
  console.log('=== PENDING STARTUPS ===');
  console.log('Total pending approval:', pendingCount);
  if (pendingSample && pendingSample.length > 0) {
    console.log('Most recent:');
    pendingSample.forEach(s => console.log('  -', s.name, '| GOD:', s.total_god_score, '|', s.created_at ? s.created_at.split('T')[0] : 'n/a'));
  }

  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
