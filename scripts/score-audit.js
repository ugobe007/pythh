require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
(async () => {
  let all = [], page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('total_god_score,team_score,traction_score,market_score,product_score,vision_score,enrichment_status')
      .eq('status','approved')
      .range(page*1000,(page+1)*1000-1);
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  const avg = v => v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : 'N/A';
  const pct = (a, total) => total ? (a/total*100).toFixed(1) : '0.0';
  const scores = all.map(s => s.total_god_score || 0).filter(s => s > 0);
  console.log('Total approved:', all.length, '| With score:', scores.length);
  console.log('Overall avg:', avg(scores), '| Min:', Math.min(...scores), '| Max:', Math.max(...scores));
  console.log('\n--- Full Distribution (5-pt buckets, ALL approved) ---');
  for (let b = 40; b <= 95; b += 5) {
    const n = scores.filter(s => s >= b && s < b+5).length;
    const p = pct(n, scores.length);
    console.log(`  ${b}-${b+4}: ${String(n).padStart(5)} (${String(p).padStart(5)}%)  ${'█'.repeat(Math.round(p/2))}`);
  }
  const enriched = all.filter(s => s.enrichment_status === 'enriched');
  const eScores = enriched.map(s => s.total_god_score || 0).filter(s => s > 0);
  console.log('\n--- Enriched only (' + enriched.length + ' startups) ---');
  console.log('  Avg:', avg(eScores));
  for (let b = 40; b <= 95; b += 5) {
    const n = eScores.filter(s => s >= b && s < b+5).length;
    const p = pct(n, eScores.length);
    console.log(`  ${b}-${b+4}: ${String(n).padStart(5)} (${String(p).padStart(5)}%)  ${'█'.repeat(Math.round(p/2))}`);
  }
  const ca = (arr, f) => avg(arr.map(s=>s[f]||0));
  console.log('\n--- Component avgs (ALL / ENRICHED) ---');
  ['team_score','traction_score','market_score','product_score','vision_score'].forEach(f =>
    console.log('  ' + f.padEnd(22) + ca(all,f).toString().padStart(6) + '  /  ' + ca(enriched,f).toString().padStart(6))
  );
  // Bonus inflation check
  const WEIGHTS = { team_score: 0.25, traction_score: 0.25, market_score: 0.20, product_score: 0.20, vision_score: 0.10 };
  console.log('\n--- Bonus inflation (component-weighted total vs stored total_god_score) ---');
  const diffs = enriched.filter(s => s.total_god_score > 0).map(s => {
    const raw = Object.entries(WEIGHTS).reduce((sum,[k,w]) => sum + (s[k]||0)*w, 0);
    return (s.total_god_score||0) - raw;
  });
  const posDiffs = diffs.filter(d => d > 0);
  console.log('  With bonus (total > weighted sum) :', posDiffs.length, '/', Math.min(enriched.length, diffs.length), `(${pct(posDiffs.length, diffs.length)}%)`);
  console.log('  Avg bonus                          :', avg(diffs));
  console.log('  Avg bonus (only positive)          :', avg(posDiffs));
  console.log('  Max bonus                          :', Math.max(...diffs).toFixed(1));
  const [b0,b5,b10,b15,b20,b25] = [0,5,10,15,20,25];
  [[0,5],[5,10],[10,15],[15,20],[20,25],[25,999]].forEach(([lo,hi]) => {
    const n = diffs.filter(d => d >= lo && d < hi).length;
    console.log(`  Bonus ${String(lo).padStart(3)}-${hi===999?'+':hi-1}: ${String(n).padStart(5)} (${pct(n,diffs.length)}%)`);
  });
})().catch(e => console.error(e.message));
