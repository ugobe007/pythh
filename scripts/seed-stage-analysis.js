#!/usr/bin/env node
/**
 * SEED STAGE & SECTOR ANALYSIS
 *
 * Answers:
 * - How many seed-stage startups are funded?
 * - Breakdown of seed by sector (Fintech, AI/ML, etc.)
 * - Hottest categories (by count + avg GOD)
 * - Leading startups (top by GOD per sector)
 *
 * Usage: node scripts/seed-stage-analysis.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

function isSeedStage(s) {
  const stage = s.stage;
  const stageEst = (s.stage_estimate || '').toLowerCase();
  if (stage === 2) return true;
  if (stageEst === 'seed') return true;
  if (stageEst.includes('seed') && !stageEst.includes('pre')) return true;
  return false;
}

function isFunded(s) {
  if (s.last_round_amount_usd && s.last_round_amount_usd > 0) return true;
  if (s.total_funding_usd && s.total_funding_usd > 0) return true;
  if (s.raise_amount && String(s.raise_amount).replace(/[^0-9.]/g, '')) return true;
  if (s.raise_type && s.raise_type.trim()) return true;
  const ext = s.extracted_data || {};
  const fm = ext.funding_mentions;
  if (Array.isArray(fm) && fm.length > 0) return true;
  if (ext.funding_amount || ext.raise_amount || (ext.funding_mentions && ext.funding_mentions.length)) return true;
  return false;
}

async function main() {
  console.log('\n📊 SEED STAGE & SECTOR ANALYSIS');
  console.log('═'.repeat(70));
  console.log('Run at:', new Date().toISOString());
  console.log('');

  // Fetch all approved startups with needed fields
  let all = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(
        'id, name, stage, stage_estimate, sectors, total_god_score, ' +
        'last_round_amount_usd, total_funding_usd, raise_amount, raise_type, extracted_data'
      )
      .eq('status', 'approved')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) {
      console.error('Supabase error:', error.message || error);
      process.exit(1);
    }
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    page++;
  }

  const totalApproved = all.length;

  // --- STAGE BREAKDOWN ---
  const byStage = { seed: [], 'pre-seed': [], 'series-a': [], 'series-b': [], 'series-c': [], other: [] };
  all.forEach((s) => {
    const est = (s.stage_estimate || '').toLowerCase();
    const stageNum = s.stage;
    if (stageNum === 2 || est === 'seed') byStage.seed.push(s);
    else if (stageNum <= 1 || est.includes('pre-seed')) byStage['pre-seed'].push(s);
    else if (stageNum === 3 || est.includes('series-a') || est.includes('series_a')) byStage['series-a'].push(s);
    else if (stageNum === 4 || est.includes('series-b') || est.includes('series_b')) byStage['series-b'].push(s);
    else if (stageNum === 5 || est.includes('series-c') || est.includes('series_c')) byStage['series-c'].push(s);
    else byStage.other.push(s);
  });

  const seedStartups = byStage.seed;
  const seedFunded = seedStartups.filter(isFunded);
  const seedUnfunded = seedStartups.filter((s) => !isFunded(s));

  console.log('1. SEED STAGE OVERVIEW');
  console.log('─'.repeat(50));
  console.log(`  Seed-stage (total):       ${seedStartups.length.toLocaleString()}`);
  console.log(`  Seed-stage (funded):      ${seedFunded.length.toLocaleString()} (${totalApproved ? ((seedFunded.length / seedStartups.length) * 100).toFixed(1) : 0}% of seed)`);
  console.log(`  Seed-stage (unfunded):    ${seedUnfunded.length.toLocaleString()}`);
  console.log('');
  console.log('  Stage breakdown (all approved):');
  Object.entries(byStage).forEach(([k, arr]) => {
    if (arr.length === 0) return;
    const pct = totalApproved ? ((arr.length / totalApproved) * 100).toFixed(1) : 0;
    console.log(`    ${k.padEnd(12)} ${arr.length.toLocaleString().padStart(6)} (${pct}%)`);
  });
  console.log('');

  // --- SECTOR BREAKDOWN (SEED) ---
  const sectorMapSeed = new Map(); // sector -> { count, funded, scores[], startups[] }
  seedStartups.forEach((s) => {
    const sectors = s.sectors || [];
    if (sectors.length === 0) {
      const key = '(no sector)';
      if (!sectorMapSeed.has(key)) sectorMapSeed.set(key, { count: 0, funded: 0, scores: [], startups: [] });
      const r = sectorMapSeed.get(key);
      r.count++;
      if (isFunded(s)) r.funded++;
      r.scores.push(s.total_god_score || 0);
      r.startups.push(s);
      return;
    }
    sectors.forEach((sec) => {
      const key = sec || '(blank)';
      if (!sectorMapSeed.has(key)) sectorMapSeed.set(key, { count: 0, funded: 0, scores: [], startups: [] });
      const r = sectorMapSeed.get(key);
      r.count++;
      if (isFunded(s)) r.funded++;
      r.scores.push(s.total_god_score || 0);
      r.startups.push(s);
    });
  });

  const sectorRows = Array.from(sectorMapSeed.entries())
    .map(([sector, r]) => ({
      sector,
      count: r.count,
      funded: r.funded,
      fundedPct: r.count ? ((r.funded / r.count) * 100).toFixed(1) : 0,
      avgGod: r.scores.length ? (r.scores.reduce((a, b) => a + b, 0) / r.scores.length).toFixed(1) : '—',
      startups: r.startups,
    }))
    .sort((a, b) => b.count - a.count);

  console.log('2. SEED STAGE BY SECTOR (top 20 by count)');
  console.log('─'.repeat(50));
  console.log(
    '  Sector'.padEnd(32) +
      'Count'.padStart(8) +
      'Funded'.padStart(8) +
      '%Fund'.padStart(8) +
      'AvgGOD'.padStart(8)
  );
  sectorRows.slice(0, 20).forEach((r) => {
    console.log(
      r.sector.substring(0, 30).padEnd(32) +
        String(r.count).padStart(8) +
        String(r.funded).padStart(8) +
        (r.fundedPct + '%').padStart(8) +
        String(r.avgGod).padStart(8)
    );
  });
  console.log('');

  // --- HOTTEST CATEGORIES (all approved, by count + avg GOD) ---
  const sectorMapAll = new Map();
  all.forEach((s) => {
    const sectors = s.sectors || [];
    if (sectors.length === 0) {
      const key = '(no sector)';
      if (!sectorMapAll.has(key)) sectorMapAll.set(key, { count: 0, scores: [], startups: [] });
      const r = sectorMapAll.get(key);
      r.count++;
      r.scores.push(s.total_god_score || 0);
      r.startups.push(s);
      return;
    }
    sectors.forEach((sec) => {
      const key = sec || '(blank)';
      if (!sectorMapAll.has(key)) sectorMapAll.set(key, { count: 0, scores: [], startups: [] });
      const r = sectorMapAll.get(key);
      r.count++;
      r.scores.push(s.total_god_score || 0);
      r.startups.push(s);
    });
  });

  const allSectorRows = Array.from(sectorMapAll.entries())
    .map(([sector, r]) => ({
      sector,
      count: r.count,
      avgGod: r.scores.length ? r.scores.reduce((a, b) => a + b, 0) / r.scores.length : 0,
      startups: r.startups,
    }))
    .filter((r) => r.sector !== '(no sector)' && r.sector !== '(blank)');

  const byCount = [...allSectorRows].sort((a, b) => b.count - a.count);
  const byAvgGod = [...allSectorRows].filter((r) => r.count >= 20).sort((a, b) => b.avgGod - a.avgGod);

  console.log('3. HOTTEST CATEGORIES (all approved)');
  console.log('─'.repeat(50));
  console.log('  By startup count (top 15):');
  byCount.slice(0, 15).forEach((r, i) => {
    console.log(
      `    ${(i + 1).toString().padStart(2)}. ${r.sector.substring(0, 35).padEnd(36)} ${r.count.toLocaleString().padStart(6)} startups`
    );
  });
  console.log('');
  console.log('  By avg GOD score (sectors with 20+ startups, top 15):');
  byAvgGod.slice(0, 15).forEach((r, i) => {
    console.log(
      `    ${(i + 1).toString().padStart(2)}. ${r.sector.substring(0, 35).padEnd(36)} ${r.avgGod.toFixed(1).padStart(5)} avg`
    );
  });
  console.log('');

  // --- LEADING STARTUPS (top by GOD per top sector) ---
  console.log('4. LEADING STARTUPS (top 5 by GOD, per top 8 sectors)');
  console.log('─'.repeat(50));

  const topSectors = byCount.slice(0, 8).map((r) => r.sector);
  topSectors.forEach((sector) => {
    const r = sectorMapAll.get(sector);
    if (!r) return;
    const sorted = r.startups
      .filter((s) => (s.sectors || []).includes(sector))
      .sort((a, b) => (b.total_god_score || 0) - (a.total_god_score || 0))
      .slice(0, 5);
    console.log(`\n  ${sector}:`);
    sorted.forEach((s, i) => {
      const god = s.total_god_score != null ? s.total_god_score : '—';
      const funded = isFunded(s) ? '💰' : '  ';
      console.log(`    ${(i + 1).toString().padStart(2)}. ${funded} ${(s.name || '').substring(0, 38).padEnd(38)} GOD ${god}`);
    });
  });

  console.log('');
  console.log('═'.repeat(70));
  console.log('Note: "Funded" = has last_round_amount_usd, total_funding_usd, raise_amount, raise_type, or funding_mentions');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
