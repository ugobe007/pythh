#!/usr/bin/env node
/**
 * Investor Scoring Audit
 * Examines the investor table, scoring, and match generation.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Investor count and basic stats
  let investors = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('investors')
      .select('id, name, firm, sectors, stage, investor_score, investor_tier, total_investments, active_fund_size, check_size_min, check_size_max, investment_thesis, bio, leads_rounds, type, created_at')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    investors = investors.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log('='.repeat(70));
  console.log('  INVESTOR SCORING AUDIT');
  console.log('='.repeat(70));
  console.log(`Total investors: ${investors.length}\n`);

  // 2. Investor score distribution
  const scores = investors.map(i => i.investor_score).filter(s => s !== null && s !== undefined);
  const noScore = investors.filter(i => i.investor_score === null || i.investor_score === undefined).length;
  
  if (scores.length > 0) {
    scores.sort((a, b) => a - b);
    console.log('INVESTOR SCORE DISTRIBUTION (0-10 scale):');
    console.log(`  Count with score: ${scores.length}`);
    console.log(`  Count without score: ${noScore}`);
    console.log(`  Min: ${scores[0]} | Median: ${scores[Math.floor(scores.length / 2)]} | Mean: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)} | Max: ${scores[scores.length - 1]}`);
    
    // Histogram
    const buckets = {};
    for (const s of scores) {
      const b = Math.floor(s);
      buckets[b] = (buckets[b] || 0) + 1;
    }
    console.log('\n  Score Histogram:');
    for (let i = 0; i <= 10; i++) {
      const count = buckets[i] || 0;
      const bar = '#'.repeat(Math.ceil(count / Math.max(1, scores.length) * 50));
      console.log(`    ${i.toString().padStart(2)}  ${count.toString().padStart(5)} (${(count / scores.length * 100).toFixed(1)}%) ${bar}`);
    }
  }

  // 3. Investor tier distribution
  console.log('\nINVESTOR TIER DISTRIBUTION:');
  const tiers = {};
  for (const inv of investors) {
    const tier = inv.investor_tier || 'none';
    tiers[tier] = (tiers[tier] || 0) + 1;
  }
  for (const [tier, count] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier.padEnd(20)} ${count.toString().padStart(5)}`);
  }

  // 4. Data completeness
  console.log('\nINVESTOR DATA COMPLETENESS:');
  const checks = [
    { name: 'has sectors', check: i => (i.sectors || []).length > 0 },
    { name: 'has stage', check: i => !!(i.stage) },
    { name: 'has investment_thesis', check: i => !!(i.investment_thesis) && i.investment_thesis.length > 10 },
    { name: 'has bio', check: i => !!(i.bio) && i.bio.length > 10 },
    { name: 'has check_size', check: i => i.check_size_min > 0 || i.check_size_max > 0 },
    { name: 'has active_fund_size', check: i => i.active_fund_size > 0 },
    { name: 'has total_investments', check: i => i.total_investments > 0 },
    { name: 'has firm', check: i => !!(i.firm) },
    { name: 'has type', check: i => !!(i.type) },
    { name: 'leads rounds', check: i => !!i.leads_rounds },
  ];
  for (const c of checks) {
    const count = investors.filter(c.check).length;
    const pct = (count / investors.length * 100).toFixed(1);
    console.log(`  ${c.name.padEnd(25)} ${count.toString().padStart(5)} (${pct}%)`);
  }

  // 5. Sector coverage
  console.log('\nINVESTOR SECTOR COVERAGE (Top 15):');
  const sectorCounts = {};
  for (const inv of investors) {
    for (const sec of (inv.sectors || [])) {
      sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
    }
  }
  const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [sec, count] of topSectors) {
    console.log(`  ${sec.padEnd(30)} ${count}`);
  }

  // 6. Stage coverage
  console.log('\nINVESTOR STAGE COVERAGE:');
  const stageCounts = {};
  for (const inv of investors) {
    const stages = Array.isArray(inv.stage) ? inv.stage : [inv.stage].filter(Boolean);
    for (const st of stages) {
      stageCounts[st] = (stageCounts[st] || 0) + 1;
    }
  }
  for (const [stage, count] of Object.entries(stageCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${stage.padEnd(20)} ${count}`);
  }

  // 7. Match statistics
  const { count: matchCount } = await sb.from('startup_investor_matches')
    .select('id', { count: 'exact', head: true });
  console.log(`\nMATCH STATISTICS:`);
  console.log(`  Total matches: ${matchCount}`);

  // Match score distribution (sample)
  const { data: matchSample } = await sb.from('startup_investor_matches')
    .select('match_score')
    .order('match_score', { ascending: false })
    .limit(1000);
  if (matchSample && matchSample.length > 0) {
    const mScores = matchSample.map(m => m.match_score).filter(s => s !== null);
    mScores.sort((a, b) => a - b);
    console.log(`  Match score sample (top 1000):`);
    console.log(`    Min: ${mScores[0]} | Median: ${mScores[Math.floor(mScores.length / 2)]} | Max: ${mScores[mScores.length - 1]}`);
  }

  // 8. Sample top and bottom investors
  console.log('\nTOP 10 INVESTORS (by score):');
  const topInv = investors.filter(i => i.investor_score != null).sort((a, b) => b.investor_score - a.investor_score).slice(0, 10);
  for (const inv of topInv) {
    console.log(`  Score ${inv.investor_score} | ${(inv.name || '').substring(0, 25).padEnd(25)} | ${(inv.firm || '').substring(0, 20).padEnd(20)} | Tier: ${inv.investor_tier || 'none'} | Sectors: ${(inv.sectors || []).slice(0, 3).join(', ')}`);
  }

  console.log('\nBOTTOM 10 INVESTORS (by score):');
  const bottomInv = investors.filter(i => i.investor_score != null).sort((a, b) => a.investor_score - b.investor_score).slice(0, 10);
  for (const inv of bottomInv) {
    console.log(`  Score ${inv.investor_score} | ${(inv.name || '').substring(0, 25).padEnd(25)} | ${(inv.firm || '').substring(0, 20).padEnd(20)} | Tier: ${inv.investor_tier || 'none'}`);
  }

  // 9. How many investors have NO scoring at all?
  console.log('\nINVESTORS WITH NO SCORE AND NO TIER:');
  const unscored = investors.filter(i => !i.investor_score && !i.investor_tier);
  console.log(`  ${unscored.length} investors have neither score nor tier`);
}

main().catch(console.error);
