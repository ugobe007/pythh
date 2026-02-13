const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

(async () => {
  const { count: total } = await sb.from('startup_uploads').select('*', { count: 'exact', head: true });
  const { count: approved } = await sb.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const { count: pending } = await sb.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending');

  const { data: scores } = await sb.from('startup_uploads').select('total_god_score').eq('status', 'approved').not('total_god_score', 'is', null);
  const godScores = scores.map(s => s.total_god_score).filter(s => s > 0);
  const avg = godScores.reduce((a, b) => a + b, 0) / godScores.length;
  const sorted = [...godScores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const { count: matches } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  const { count: investors } = await sb.from('investors').select('*', { count: 'exact', head: true });
  const { count: discovered } = await sb.from('discovered_startups').select('*', { count: 'exact', head: true });

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { count: recent } = await sb.from('startup_uploads').select('*', { count: 'exact', head: true }).gte('created_at', cutoff);

  const { data: allNames } = await sb.from('startup_uploads').select('name').eq('status', 'approved');
  const nameCounts = {};
  allNames.forEach(s => { const n = (s.name || '').toLowerCase().trim(); if (n) nameCounts[n] = (nameCounts[n] || 0) + 1; });
  const dupes = Object.entries(nameCounts).filter(([k, v]) => v > 1).sort((a, b) => b[1] - a[1]).slice(0, 20);

  const { data: junkCandidates } = await sb.from('startup_uploads').select('id, name, website').eq('status', 'approved').order('created_at', { ascending: false }).limit(1000);
  const junk = junkCandidates.filter(s => {
    const n = (s.name || '').trim();
    if (!n || n.length < 2) return true;
    if (/^(test|example|asdf|xxx|untitled|unknown|null|undefined|n\/a|none|tbd|placeholder)/i.test(n)) return true;
    if (/^https?:\/\//i.test(n)) return true;
    if (/^[^a-zA-Z]*$/.test(n)) return true;
    if (n.length > 100) return true;
    return false;
  });

  const { count: withEmbeddings } = await sb.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved').not('embedding', 'is', null);

  console.log('=== SYSTEM HEALTH REPORT ===');
  console.log('');
  console.log('[1] SCRAPER / PIPELINE');
  console.log('  Discovered startups:', discovered);
  console.log('  New startups (48h):', recent);
  console.log('');
  console.log('[2] STARTUPS');
  console.log('  Total:', total);
  console.log('  Approved:', approved);
  console.log('  Pending:', pending);
  console.log('');
  console.log('[3] SIGNALS / GOD SCORES');
  console.log('  Scored startups:', godScores.length);
  console.log('  Avg GOD:', avg.toFixed(1));
  console.log('  Median:', median);
  console.log('  Range:', min, '-', max);
  console.log('');
  console.log('[4] ML / MATCHING');
  console.log('  Investors:', investors);
  console.log('  Total matches:', matches);
  console.log('  Embeddings:', withEmbeddings, '/', approved, '(' + (approved > 0 ? ((withEmbeddings / approved) * 100).toFixed(1) : 0) + '%)');
  console.log('');
  console.log('[5] DUPLICATES (' + dupes.length + ' names appear 2+ times)');
  dupes.forEach(([name, count]) => console.log('  ' + count + 'x  ' + name));
  console.log('');
  console.log('[5b] JUNK NAMES (' + junk.length + ' suspicious)');
  junk.slice(0, 25).forEach(s => console.log('  - "' + s.name + '" | ' + (s.website || 'no url')));
})().catch(e => console.error('ERROR:', e.message));
