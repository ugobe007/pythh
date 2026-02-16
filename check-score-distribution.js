require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Paginate to get all approved startups
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('status', 'approved')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const scores = all.map(s => s.total_god_score).filter(s => s != null);
  scores.sort((a, b) => a - b);
  const n = scores.length;
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const p10 = scores[Math.floor(n * 0.1)];
  const p25 = scores[Math.floor(n * 0.25)];
  const p50 = scores[Math.floor(n * 0.5)];
  const p75 = scores[Math.floor(n * 0.75)];
  const p90 = scores[Math.floor(n * 0.9)];
  const p95 = scores[Math.floor(n * 0.95)];
  const min = scores[0];
  const max = scores[n - 1];
  const iqr = p75 - p25;

  console.log('=== NEW SCORE DISTRIBUTION (ALL Approved Startups) ===');
  console.log('Count:', n);
  console.log('Min:', min, '| Max:', max);
  console.log('Avg:', avg.toFixed(1));
  console.log('P10:', p10, '| P25:', p25, '| P50:', p50, '| P75:', p75, '| P90:', p90, '| P95:', p95);
  console.log('IQR (P75-P25):', iqr, '(was 3)');
  console.log('');

  // Component averages (only startups with score > 40 for meaningful comparison)
  const meaningful = all.filter(s => s.total_god_score > 40);
  const compAvg = (field) => {
    const vals = meaningful.map(s => s[field]).filter(v => v != null);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
  };
  console.log('=== COMPONENT AVERAGES (startups scoring > 40) ===');
  console.log('Team:', compAvg('team_score'), '(was 48.1)');
  console.log('Traction:', compAvg('traction_score'), '(was 48.2)');
  console.log('Market:', compAvg('market_score'), '(was 45.3)');
  console.log('Product:', compAvg('product_score'), '(was 27.2)');
  console.log('Vision:', compAvg('vision_score'), '(was 48.6)');
  console.log('');

  // Full component averages for ALL approved
  const compAvgAll = (field) => {
    const vals = all.map(s => s[field]).filter(v => v != null);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
  };
  console.log('=== COMPONENT AVERAGES (ALL approved) ===');
  console.log('Team:', compAvgAll('team_score'));
  console.log('Traction:', compAvgAll('traction_score'));
  console.log('Market:', compAvgAll('market_score'));
  console.log('Product:', compAvgAll('product_score'));
  console.log('Vision:', compAvgAll('vision_score'));
  console.log('');

  // Score tier distribution
  const tiers = [
    { label: '40 (floor)', fn: s => s === 40 },
    { label: '41-49', fn: s => s >= 41 && s < 50 },
    { label: '50-59', fn: s => s >= 50 && s < 60 },
    { label: '60-69', fn: s => s >= 60 && s < 70 },
    { label: '70-79', fn: s => s >= 70 && s < 80 },
    { label: '80-89', fn: s => s >= 80 && s < 90 },
    { label: '90-100', fn: s => s >= 90 && s <= 100 },
  ];
  console.log('=== TIER DISTRIBUTION ===');
  for (const tier of tiers) {
    const count = scores.filter(tier.fn).length;
    console.log(`${tier.label}: ${count} (${(count / n * 100).toFixed(1)}%)`);
  }
  
  // Top 20 startups
  console.log('');
  console.log('=== TOP 20 STARTUPS ===');
  const { data: top20 } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .limit(20);
  if (top20) {
    for (const s of top20) {
      console.log(`  ${s.total_god_score} | ${s.name} | T:${s.team_score} Tr:${s.traction_score} M:${s.market_score} P:${s.product_score} V:${s.vision_score}`);
    }
  }
})();
