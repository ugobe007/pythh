const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  let all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .range(from, from + PAGE - 1);
    if (error || !data || !data.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const scores = all.map(r => r.total_god_score).filter(s => s != null);
  const sorted = [...scores].sort((a, b) => a - b);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const med = sorted[Math.floor(scores.length / 2)];
  const buckets = {};
  for (const s of scores) { const b = Math.floor(s / 10) * 10; buckets[b] = (buckets[b] || 0) + 1; }
  console.log(`TOTAL n: ${scores.length}  avg: ${avg}  median: ${med}  max: ${Math.max(...scores)}  min: ${Math.min(...scores)}`);
  console.log(`>=90: ${scores.filter(s => s >= 90).length}  >=80: ${scores.filter(s => s >= 80).length}  >=70: ${scores.filter(s => s >= 70).length}  >=60: ${scores.filter(s => s >= 60).length}  <50: ${scores.filter(s => s < 50).length}  <40: ${scores.filter(s => s < 40).length}`);
  console.log('Distribution:');
  Object.entries(buckets).sort((a, b) => +a[0] - +b[0]).forEach(([k, v]) =>
    console.log(`  ${k}-${+k + 9}: ${String(v).padStart(5)}  ${'█'.repeat(Math.round(v / 50))}`));
})();
