const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('total_god_score, name')
      .eq('status', 'approved')
      .range(from, from + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const scores = all.map(r => r.total_god_score).filter(s => s != null);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  console.log(`\n📊 Full distribution — n: ${scores.length}  avg: ${avg}  median: ${median}  max: ${Math.max(...scores)}  min: ${Math.min(...scores)}`);

  // Real startups (≥50)
  const real = all.filter(r => r.total_god_score >= 50);
  const avgReal = (real.reduce((a, b) => a + b.total_god_score, 0) / real.length).toFixed(1);
  console.log(`\n🚀 Meaningful startups (≥50): n=${real.length}  avg=${avgReal}`);

  // Top 15
  const top15 = all.filter(r => r.total_god_score != null)
    .sort((a, b) => b.total_god_score - a.total_god_score)
    .slice(0, 15);
  console.log('\n🏆 Top 15 startups:');
  top15.forEach(r => console.log(`   ${String(Math.round(r.total_god_score)).padStart(3)} | ${(r.name || '').slice(0, 55)}`));
})();
