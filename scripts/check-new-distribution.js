const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .in('status', ['pending', 'approved'])
      .order('total_god_score', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    page++;
  }

  const scores = all.map(s => s.total_god_score || 0);
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
  const sorted = [...scores].sort((a,b) => a-b);
  const p10 = sorted[Math.floor(sorted.length*0.1)];
  const p25 = sorted[Math.floor(sorted.length*0.25)];
  const median = sorted[Math.floor(sorted.length*0.5)];
  const p75 = sorted[Math.floor(sorted.length*0.75)];
  const p90 = sorted[Math.floor(sorted.length*0.9)];
  
  console.log('=== FULL GOD SCORE DISTRIBUTION (ALL STARTUPS) ===');
  console.log('Count:', scores.length);
  console.log('Min:', sorted[0], '| Max:', sorted[sorted.length-1]);
  console.log('P10:', p10, '| P25:', p25, '| Median:', median, '| P75:', p75, '| P90:', p90);
  console.log('Average:', avg.toFixed(1));
  
  const buckets = {};
  for (let b = 40; b <= 85; b += 5) buckets[b] = 0;
  scores.forEach(s => {
    const b = Math.min(Math.floor(s/5)*5, 85);
    if (b < 40) buckets[40] = (buckets[40]||0) + 1;
    else buckets[b] = (buckets[b]||0) + 1;
  });
  console.log('\nBuckets (5-pt):');
  Object.entries(buckets).sort((a,b)=>a[0]-b[0]).forEach(([k,v]) => {
    const pct = (v/scores.length*100).toFixed(1);
    const bar = '#'.repeat(Math.round(pct/2));
    console.log('  ' + String(k).padStart(3) + '-' + String(+k+4).padStart(3) + ': ' + String(v).padStart(5) + ' (' + pct.padStart(5) + '%) ' + bar);
  });
}

main().catch(console.error);
