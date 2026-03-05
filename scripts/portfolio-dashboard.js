#!/usr/bin/env node
/**
 * Portfolio Health Dashboard
 * Full snapshot of the platform: startups, investors, matches, scores
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const [
    { count: totalApproved },
    { count: totalInvestors },
    { count: totalMatches },
    { count: superMatches },
    { count: highConfidence },
    { count: enriched },
    { data: scoreData },
    { data: stageDist },
    { data: sectorDist },
    { data: recentStartups },
  ] = await Promise.all([
    sb.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    sb.from('investors').select('*', { count: 'exact', head: true }),
    sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
    sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).gte('match_score', 70),
    sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).gte('match_score', 45),
    sb.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved').not('extracted_data->web_signals', 'is', null),
    sb.from('startup_uploads').select('total_god_score').eq('status', 'approved').not('total_god_score', 'is', null).limit(10000),
    sb.from('startup_uploads').select('stage').eq('status', 'approved').not('stage', 'is', null).limit(10000),
    sb.from('startup_uploads').select('sectors').eq('status', 'approved').not('sectors', 'is', null).limit(10000),
    sb.from('startup_uploads').select('name, total_god_score, sectors, stage, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(10),
  ]);

  // Score stats
  const scores = (scoreData || []).map(s => s.total_god_score).filter(Boolean);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = Math.max(...scores);
  const ge90 = scores.filter(s => s >= 90).length;
  const ge80 = scores.filter(s => s >= 80).length;
  const ge70 = scores.filter(s => s >= 70).length;
  const ge60 = scores.filter(s => s >= 60).length;
  const lt40 = scores.filter(s => s < 40).length;

  // Stage distribution
  const stages = {};
  for (const s of (stageDist || [])) {
    const st = String(s.stage || 'Unknown');
    stages[st] = (stages[st] || 0) + 1;
  }

  // Sector distribution (top 10)
  const sectors = {};
  for (const s of (sectorDist || [])) {
    for (const sec of (s.sectors || [])) {
      sectors[sec] = (sectors[sec] || 0) + 1;
    }
  }
  const topSectors = Object.entries(sectors).sort((a, b) => b[1] - a[1]).slice(0, 10);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           HOT HONEY — PORTFOLIO HEALTH DASHBOARD         ║');
  console.log(`║                     ${new Date().toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'})}                     ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📦 INVENTORY');
  console.log(`  Startups (approved):   ${totalApproved?.toLocaleString()}`);
  console.log(`  Investors:             ${totalInvestors?.toLocaleString()}`);
  console.log(`  Total matches:         ${totalMatches?.toLocaleString()}`);
  console.log(`  Super matches (≥70):   ${superMatches?.toLocaleString()}`);
  console.log(`  Quality matches (≥45): ${highConfidence?.toLocaleString()}`);
  console.log(`  Web-enriched:          ${enriched?.toLocaleString()} / ${totalApproved?.toLocaleString()} (${Math.round((enriched||0)/(totalApproved||1)*100)}%)`);

  console.log('\n🎯 GOD SCORE DISTRIBUTION');
  console.log(`  Avg: ${avg}   Median: ${median}   Max: ${max}`);
  console.log(`  ≥90 (Exceptional):  ${ge90.toLocaleString().padStart(5)}  (${(ge90/scores.length*100).toFixed(1)}%)`);
  console.log(`  ≥80 (Elite):        ${ge80.toLocaleString().padStart(5)}  (${(ge80/scores.length*100).toFixed(1)}%)`);
  console.log(`  ≥70 (Hot):          ${ge70.toLocaleString().padStart(5)}  (${(ge70/scores.length*100).toFixed(1)}%)`);
  console.log(`  ≥60 (Strong):       ${ge60.toLocaleString().padStart(5)}  (${(ge60/scores.length*100).toFixed(1)}%)`);
  console.log(`  <40 (Sparse/Weak):  ${lt40.toLocaleString().padStart(5)}  (${(lt40/scores.length*100).toFixed(1)}%)`);

  console.log('\n🏗️  STAGE BREAKDOWN');
  Object.entries(stages).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([stage, n]) => {
    const bar = '█'.repeat(Math.round(n / (totalApproved || 1) * 50));
    console.log(`  ${String(stage).padEnd(16)} ${String(n).padStart(5)}  ${bar}`);
  });

  console.log('\n🏭 TOP SECTORS');
  topSectors.forEach(([sector, n]) => {
    const bar = '█'.repeat(Math.round(n / (totalApproved || 1) * 40));
    console.log(`  ${(sector || '').padEnd(22)} ${String(n).padStart(5)}  ${bar}`);
  });

  console.log('\n🆕 RECENTLY ADDED (last 10)');
  (recentStartups || []).forEach(s => {
    const age = Math.round((Date.now() - new Date(s.created_at)) / 86400000);
    const secs = (s.sectors || []).slice(0, 2).join(', ');
    const stageStr = String(s.stage || '').slice(0, 12);
    console.log(`  [${s.total_god_score || '--'}] ${(s.name || '').slice(0, 35).padEnd(35)} ${stageStr.padEnd(12)} ${secs}  (${age}d ago)`);
  });

  console.log('\n');
})();
