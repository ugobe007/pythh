require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data: d1, error: e1 } = await sb.from('discovered_startups').select('name, source, created_at, funding_amount, sectors').order('created_at', { ascending: false }).limit(5);
  console.log('discovered:', d1?.length, e1?.message || '');
  if (d1) d1.forEach(r => console.log('  ', r.name, '|', r.source, '|', r.funding_amount, '|', String(r.created_at).substring(0,10)));

  const { data: d2, error: e2 } = await sb.from('rss_sources').select('name, url, status').limit(5);
  console.log('\nrss_sources:', d2?.length, e2?.message || '');
  if (d2) d2.forEach(r => console.log('  ', r.name, r.status));

  const { data: d3, error: e3 } = await sb.from('ai_logs').select('type, message, created_at').order('created_at', { ascending: false }).limit(5);
  console.log('\nai_logs:', d3?.length, e3?.message || '');
  if (d3) d3.forEach(r => console.log('  ', r.type, String(r.created_at).substring(0,16), String(r.message).substring(0,80)));

  // Sectors from approved startups
  const { data: sectorData } = await sb.from('startup_uploads').select('sector').eq('status', 'approved').not('sector', 'is', null).limit(1000);
  const sectors = {};
  if (sectorData) sectorData.forEach(s => { if (s.sector) sectors[s.sector] = (sectors[s.sector] || 0) + 1; });
  const sorted = Object.entries(sectors).sort((a,b) => b[1] - a[1]).slice(0, 10);
  console.log('\nTop sectors:', JSON.stringify(sorted));
  
  // Recent score recalculations 
  const { data: recents } = await sb.from('startup_uploads').select('name, total_god_score, updated_at').eq('status', 'approved').order('updated_at', { ascending: false }).limit(5);
  console.log('\nRecently updated:', JSON.stringify(recents, null, 2));
})();
