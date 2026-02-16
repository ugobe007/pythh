#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function analyze() {
  // Paginate all approved startups
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('startup_uploads')
      .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, enhanced_god_score, sectors, status')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }

  console.log('================================================================');
  console.log('  GOD SCORE ANALYSIS - POST-RECALCULATION');
  console.log('================================================================');
  console.log('Total approved startups:', all.length);

  // Basic stats
  const scores = all.map(s => s.total_god_score).filter(s => s != null).sort((a, b) => a - b);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median = scores[Math.floor(scores.length / 2)];
  const p10 = scores[Math.floor(scores.length * 0.1)];
  const p25 = scores[Math.floor(scores.length * 0.25)];
  const p75 = scores[Math.floor(scores.length * 0.75)];
  const p90 = scores[Math.floor(scores.length * 0.9)];
  const p99 = scores[Math.floor(scores.length * 0.99)];
  const min = scores[0];
  const max = scores[scores.length - 1];

  console.log();
  console.log('DISTRIBUTION STATS:');
  console.log('  Min:', min, '| P10:', p10, '| P25:', p25, '| Median:', median);
  console.log('  Mean:', avg.toFixed(1), '| P75:', p75, '| P90:', p90, '| P99:', p99, '| Max:', max);

  // Tier distribution
  const tiers = {
    'PhD (80-100)': scores.filter(s => s >= 80).length,
    'Masters (60-79)': scores.filter(s => s >= 60 && s < 80).length,
    'Bachelors (45-59)': scores.filter(s => s >= 45 && s < 60).length,
    'Freshman (40-44)': scores.filter(s => s >= 40 && s < 45).length,
    'Below 40': scores.filter(s => s < 40).length,
  };

  console.log();
  console.log('TIER DISTRIBUTION:');
  const total = scores.length;
  for (const [tier, count] of Object.entries(tiers)) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = '#'.repeat(Math.round(count / total * 50));
    console.log('  ' + tier.padEnd(20) + String(count).padStart(5) + ' (' + pct.padStart(5) + '%) ' + bar);
  }

  // Histogram (5-point buckets)
  console.log();
  console.log('SCORE HISTOGRAM (5-pt buckets):');
  for (let bucket = 40; bucket <= 95; bucket += 5) {
    const count = scores.filter(s => s >= bucket && s < bucket + 5).length;
    const pct = ((count / total) * 100).toFixed(1);
    const bar = '#'.repeat(Math.round(count / total * 60));
    console.log('  ' + (bucket + '-' + (bucket + 4)).padEnd(8) + String(count).padStart(5) + ' (' + pct.padStart(5) + '%) ' + bar);
  }
  // 100 bucket
  const count100 = scores.filter(s => s === 100).length;
  if (count100 > 0) {
    console.log('  100      ' + String(count100).padStart(5) + ' (' + ((count100 / total) * 100).toFixed(1).padStart(5) + '%)');
  }

  // Component score averages
  console.log();
  console.log('COMPONENT SCORE AVERAGES (0-100 scale):');
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  for (const comp of components) {
    const vals = all.map(s => s[comp]).filter(v => v != null);
    if (vals.length === 0) {
      console.log('  ' + comp.replace('_score', '').padEnd(12) + 'no data');
      continue;
    }
    const cavg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const cmin = Math.min(...vals);
    const cmax = Math.max(...vals);
    console.log('  ' + comp.replace('_score', '').padEnd(12) + 'avg: ' + cavg.toFixed(1).padStart(5) + '  min: ' + String(cmin).padStart(3) + '  max: ' + String(cmax).padStart(3) + '  count: ' + vals.length);
  }

  // Enhanced GOD score stats
  const enhanced = all.filter(s => s.enhanced_god_score != null);
  if (enhanced.length > 0) {
    const eavg = enhanced.reduce((a, s) => a + s.enhanced_god_score, 0) / enhanced.length;
    console.log();
    console.log('ENHANCED GOD SCORE:');
    console.log('  Startups with enhanced score:', enhanced.length);
    console.log('  Average enhanced score:', eavg.toFixed(1));
    // Compare enhanced vs total
    const bothScores = enhanced.filter(s => s.total_god_score != null);
    if (bothScores.length > 0) {
      const avgDiff = bothScores.reduce((a, s) => a + (s.enhanced_god_score - s.total_god_score), 0) / bothScores.length;
      console.log('  Avg diff (enhanced - total):', avgDiff.toFixed(1));
    }
  }

  // Top 20 startups
  console.log();
  console.log('TOP 20 STARTUPS:');
  const sorted = [...all].sort((a, b) => (b.total_god_score || 0) - (a.total_god_score || 0));
  sorted.slice(0, 20).forEach((s, i) => {
    const parts = [
      'T:' + (s.team_score ?? '-'),
      'Tr:' + (s.traction_score ?? '-'),
      'M:' + (s.market_score ?? '-'),
      'P:' + (s.product_score ?? '-'),
      'V:' + (s.vision_score ?? '-'),
    ].join(' ');
    console.log('  ' + String(i + 1).padStart(2) + '. GOD ' + String(s.total_god_score).padStart(3) + ' | ' + (s.name || 'unnamed').substring(0, 35).padEnd(35) + ' | ' + parts);
  });

  // Bottom 20
  console.log();
  console.log('BOTTOM 20 STARTUPS:');
  sorted.slice(-20).forEach((s, i) => {
    const parts = [
      'T:' + (s.team_score ?? '-'),
      'Tr:' + (s.traction_score ?? '-'),
      'M:' + (s.market_score ?? '-'),
      'P:' + (s.product_score ?? '-'),
      'V:' + (s.vision_score ?? '-'),
    ].join(' ');
    console.log('  ' + String(i + 1).padStart(2) + '. GOD ' + String(s.total_god_score).padStart(3) + ' | ' + (s.name || 'unnamed').substring(0, 35).padEnd(35) + ' | ' + parts);
  });

  // Null score check
  const nullScores = all.filter(s => s.total_god_score == null);
  if (nullScores.length > 0) {
    console.log();
    console.log('WARNING: ' + nullScores.length + ' startups with NULL total_god_score');
    nullScores.slice(0, 10).forEach(s => console.log('  - ' + s.name));
  }

  // Sector breakdown (top 10 by count)
  console.log();
  console.log('SECTOR ANALYSIS (Top 10 by count):');
  const sectorMap = {};
  all.forEach(s => {
    const sectors = Array.isArray(s.sectors) ? s.sectors : [];
    sectors.forEach(sec => {
      if (!sectorMap[sec]) sectorMap[sec] = { count: 0, totalScore: 0 };
      sectorMap[sec].count++;
      sectorMap[sec].totalScore += s.total_god_score || 0;
    });
  });
  Object.entries(sectorMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([sector, d]) => {
      console.log('  ' + sector.padEnd(25) + String(d.count).padStart(5) + ' startups | avg GOD: ' + (d.totalScore / d.count).toFixed(1));
    });

  // Score clustering analysis - how many at exactly the floor?
  const atFloor = scores.filter(s => s === 40).length;
  const at41 = scores.filter(s => s === 41).length;
  const at42 = scores.filter(s => s === 42).length;
  console.log();
  console.log('FLOOR CLUSTERING:');
  console.log('  At exactly 40:', atFloor, '(' + ((atFloor / total) * 100).toFixed(1) + '%)');
  console.log('  At exactly 41:', at41);
  console.log('  At exactly 42:', at42);
}

analyze().catch(console.error);
