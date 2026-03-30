#!/usr/bin/env node
/**
 * PORTFOLIO REGRESSION
 *
 * Analyzes VC portfolio companies: GOD score vs actual performance.
 * Use to validate and fine-tune the scoring system.
 *
 * Data: vc_portfolio_exhaust (manual import) + startup_uploads (GOD scores)
 * Performance: raw.performance_* or startup_uploads funding columns
 *
 * Usage:
 *   node scripts/portfolio-regression.js
 *   node scripts/portfolio-regression.js --investor "Sequoia"
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const filterInvestor = process.argv.find((a) => a.startsWith('--investor='))?.split('=')[1];

function isFunded(s) {
  if (s.last_round_amount_usd && s.last_round_amount_usd > 0) return true;
  if (s.total_funding_usd && s.total_funding_usd > 0) return true;
  if (s.raise_amount && String(s.raise_amount).replace(/[^0-9.]/g, '')) return true;
  const ext = s.extracted_data || {};
  if (ext.funding_amount || (ext.funding_mentions && ext.funding_mentions.length)) return true;
  return false;
}

function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? null : num / den;
}

async function main() {
  console.log('\n📊 PORTFOLIO REGRESSION: GOD vs Performance');
  console.log('═'.repeat(60));
  console.log('Run at:', new Date().toISOString());
  if (filterInvestor) console.log('Filter: investor contains', filterInvestor);
  console.log('');

  // 1. Fetch portfolio exhaust with startup link + GOD
  let query = supabase
    .from('vc_portfolio_exhaust')
    .select('id, investor_id, startup_id, startup_name, raw')
    .not('startup_id', 'is', null);

  const { data: exhaustRows, error } = await query;
  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  let rows = exhaustRows || [];
  if (filterInvestor && rows.length > 0) {
    const invIds = [...new Set(rows.map((r) => r.investor_id).filter(Boolean))];
    const { data: investors } = await supabase.from('investors').select('id, name').in('id', invIds);
    const invMap = new Map((investors || []).map((i) => [i.id, i.name]));
    rows = rows.filter((r) => invMap.get(r.investor_id)?.toLowerCase().includes(filterInvestor.toLowerCase()));
  }

  const startupIds = [...new Set(rows.map((r) => r.startup_id).filter(Boolean))];
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, last_round_amount_usd, total_funding_usd, raise_amount, extracted_data')
    .in('id', startupIds);
  const startupMap = new Map((startups || []).map((s) => [s.id, s]));

  const portfolioRows = rows.map((r) => ({
    ...r,
    startup_uploads: startupMap.get(r.startup_id),
  })).filter((r) => r.startup_uploads);
  console.log('1. SAMPLE');
  console.log('─'.repeat(50));
  console.log(`  Portfolio companies with GOD score: ${rows.length}`);
  if (!rows || rows.length === 0) {
    console.log('\n  No data. Import portfolios first:');
    console.log('    node scripts/import-portfolio-csv.js path/to/portfolio.csv');
    console.log('\n  CSV columns: investor, company_name, company_website, round, amount, source_url');
    process.exit(0);
  }

  const samples = rows.map((r) => {
    const su = r.startup_uploads || {};
    const raw = r.raw || {};
    const perf = raw.performance_status || (isFunded(su) ? 'funded' : 'active');
    return {
      name: su.name || r.startup_name,
      god: su.total_god_score,
      team: su.team_score,
      traction: su.traction_score,
      market: su.market_score,
      product: su.product_score,
      vision: su.vision_score,
      funded: isFunded(su),
      totalFunding: su.total_funding_usd || 0,
      perfStatus: perf,
    };
  });

  // 2. GOD distribution
  const byBucket = { '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90+': 0 };
  samples.forEach((s) => {
    const g = s.god || 0;
    if (g < 50) byBucket['40-49']++;
    else if (g < 60) byBucket['50-59']++;
    else if (g < 70) byBucket['60-69']++;
    else if (g < 80) byBucket['70-79']++;
    else if (g < 90) byBucket['80-89']++;
    else byBucket['90+']++;
  });

  console.log('\n  GOD score distribution:');
  Object.entries(byBucket).forEach(([b, c]) => {
    const pct = rows.length ? ((c / rows.length) * 100).toFixed(1) : 0;
    console.log(`    ${b}: ${c} (${pct}%)`);
  });

  // 3. Funded rate by GOD bucket
  const fundedByBucket = { '40-49': [0, 0], '50-59': [0, 0], '60-69': [0, 0], '70-79': [0, 0], '80-89': [0, 0], '90+': [0, 0] };
  samples.forEach((s) => {
    const g = s.god || 0;
    let b;
    if (g < 50) b = '40-49';
    else if (g < 60) b = '50-59';
    else if (g < 70) b = '60-69';
    else if (g < 80) b = '70-79';
    else if (g < 90) b = '80-89';
    else b = '90+';
    fundedByBucket[b][0] += s.funded ? 1 : 0;
    fundedByBucket[b][1]++;
  });

  console.log('\n2. FUNDED RATE BY GOD BUCKET');
  console.log('─'.repeat(50));
  Object.entries(fundedByBucket).forEach(([b, [funded, total]]) => {
    const pct = total ? ((funded / total) * 100).toFixed(1) : 0;
    console.log(`  GOD ${b}: ${funded}/${total} funded (${pct}%)`);
  });

  // 4. Correlation: GOD vs funded (binary)
  const godScores = samples.map((s) => s.god || 0);
  const fundedBinary = samples.map((s) => (s.funded ? 1 : 0));
  const corrFunded = pearson(godScores, fundedBinary);
  console.log('\n3. CORRELATION');
  console.log('─'.repeat(50));
  console.log(`  GOD score vs funded (0/1): r = ${corrFunded != null ? corrFunded.toFixed(3) : 'n/a'}`);

  // GOD vs ln(funding) for funded companies
  const fundedOnly = samples.filter((s) => s.funded && s.totalFunding > 0);
  if (fundedOnly.length >= 5) {
    const godForFunded = fundedOnly.map((s) => s.god || 0);
    const lnFunding = fundedOnly.map((s) => Math.log(s.totalFunding + 1));
    const corrFunding = pearson(godForFunded, lnFunding);
    console.log(`  GOD vs ln(total_funding) [funded only]: r = ${corrFunding != null ? corrFunding.toFixed(3) : 'n/a'}`);
  }

  // 5. Component correlation with funded
  const comps = ['team', 'traction', 'market', 'product', 'vision'];
  console.log('\n4. COMPONENT CORRELATION WITH FUNDED');
  console.log('─'.repeat(50));
  comps.forEach((comp) => {
    const vals = samples.map((s) => s[comp] || 0);
    const r = pearson(vals, fundedBinary);
    console.log(`  ${comp.padEnd(10)}: r = ${r != null ? r.toFixed(3) : 'n/a'}`);
  });

  // 6. Recommendations
  console.log('\n5. IMPLICATIONS');
  console.log('─'.repeat(50));
  if (corrFunded != null && corrFunded > 0.1) {
    console.log('  ✓ Positive correlation: higher GOD → higher funded rate (supports scoring).');
  } else if (corrFunded != null && corrFunded < -0.1) {
    console.log('  ⚠ Negative correlation: review scoring calibration.');
  } else {
    console.log('  → Weak or no correlation: need more data or different outcome definition.');
  }

  const bestComp = comps
    .map((c) => ({ comp: c, r: pearson(samples.map((s) => s[c] || 0), fundedBinary) }))
    .filter((x) => x.r != null)
    .sort((a, b) => (b.r || 0) - (a.r || 0))[0];
  if (bestComp && bestComp.r > 0.1) {
    console.log(`  → Strongest predictor: ${bestComp.comp} (r=${bestComp.r.toFixed(2)})`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Add performance data to vc_portfolio_exhaust.raw for richer analysis.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
