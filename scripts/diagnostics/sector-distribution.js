#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('sectors, total_god_score')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }

  const sectorMap = {};
  all.forEach(s => {
    (s.sectors || []).forEach(sec => {
      if (!sectorMap[sec]) sectorMap[sec] = { count: 0, totalScore: 0 };
      sectorMap[sec].count++;
      sectorMap[sec].totalScore += s.total_god_score || 0;
    });
  });

  console.log('SECTOR DISTRIBUTION (post-cleanup):');
  console.log('Total startups: ' + all.length);
  console.log();
  Object.entries(sectorMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .forEach(([sector, d]) => {
      const avg = (d.totalScore / d.count).toFixed(1);
      console.log('  ' + sector.padEnd(25) + String(d.count).padStart(5) + ' | avg GOD: ' + avg);
    });
}
main().catch(console.error);
