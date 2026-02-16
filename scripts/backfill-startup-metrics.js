#!/usr/bin/env node
/**
 * BACKFILL: Startup Domain + Metrics (Batched)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Two-phase backfill using exec_ddl RPC for safe UPDATE statements:
 *   Phase 1: Domain normalization (company_domain, confidence, source)
 *   Phase 2: Metric parsing (funding, traction, economics)
 *
 * Uses batched UPDATE statements via exec_ddl (same pattern as fund inference).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { extractCompanyDomain } = require('./startup-domain-normalizer');
const { runStartupPipeline, formatAmount } = require('./startup-metric-parser');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BATCH_SIZE = 25; // Smaller batches due to larger UPDATE payloads
const SELECT_FIELDS = [
  'id', 'name', 'pitch', 'description', 'tagline',
  'website', 'source_url', 'linkedin',
  'raise_amount', 'raise_type', 'stage', 'source_type',
  'extracted_data',
  'latest_funding_amount', 'latest_funding_round', 'latest_funding_date',
  'revenue_annual', 'mrr', 'arr',
  'team_size', 'team_size_estimate', 'customer_count',
  'total_god_score',
].join(', ');

async function main() {
  const args = process.argv.slice(2);
  const statusFilter = args.includes('--all') ? null : 'approved';
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  BACKFILL: Startup Domain + Metrics v1 (Batched)          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`  Status filter: ${statusFilter || 'ALL'}`);
  console.log(`  Dry run: ${dryRun}`);
  if (limit) console.log(`  Limit: ${limit}`);
  console.log('');

  // Fetch startups (paginated — Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  let allStartups = [];
  let pageOffset = 0;
  let keepFetching = true;

  while (keepFetching) {
    let query = supabase
      .from('startup_uploads')
      .select(SELECT_FIELDS)
      .order('total_god_score', { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data: page, error } = await query;
    if (error) { console.error('DB Error:', error.message); return; }

    allStartups = allStartups.concat(page || []);
    console.log(`  📥 Fetched page ${Math.floor(pageOffset / PAGE_SIZE) + 1}: ${(page || []).length} rows (total: ${allStartups.length})`);

    if (!page || page.length < PAGE_SIZE) {
      keepFetching = false;
    } else {
      pageOffset += PAGE_SIZE;
    }

    if (limit && allStartups.length >= limit) {
      allStartups = allStartups.slice(0, limit);
      keepFetching = false;
    }
  }

  const startups = allStartups;
  console.log(`\n📦 Processing ${startups.length} startups in batches of ${BATCH_SIZE}\n`);

  // ────── Process all startups ──────
  let applied = 0;
  let errors = 0;
  const domainStats = { website_field: 0, extracted_data_canonical: 0, extracted_data_source_url: 0, article_path_inference: 0, name_inference: 0, none: 0 };
  const metricStats = { with_funding: 0, with_traction: 0, with_valuation: 0, with_arr: 0, with_revenue: 0, with_headcount: 0, with_customers: 0, no_metrics: 0 };
  const roundTypeStats = {};
  const fundingBuckets = { '0': 0, '<1M': 0, '1-10M': 0, '10-50M': 0, '50-200M': 0, '200M-1B': 0, '1B+': 0 };
  const confBuckets = { 'none': 0, '<0.3': 0, '0.3-0.5': 0, '0.5-0.7': 0, '0.7-0.9': 0, '0.9+': 0 };

  // Build all results first
  const results = startups.map(startup => {
    const domain = extractCompanyDomain(startup);
    const metrics = runStartupPipeline(startup);
    return { startup, domain, metrics };
  });

  // Track stats
  for (const { domain, metrics } of results) {
    domainStats[domain.source] = (domainStats[domain.source] || 0) + 1;

    if (metrics.last_round_amount_usd) {
      metricStats.with_funding++;
      const rt = metrics.last_round_type || 'unknown';
      roundTypeStats[rt] = (roundTypeStats[rt] || 0) + 1;
      const amt = metrics.last_round_amount_usd;
      if (amt < 1_000_000) fundingBuckets['<1M']++;
      else if (amt < 10_000_000) fundingBuckets['1-10M']++;
      else if (amt < 50_000_000) fundingBuckets['10-50M']++;
      else if (amt < 200_000_000) fundingBuckets['50-200M']++;
      else if (amt < 1_000_000_000) fundingBuckets['200M-1B']++;
      else fundingBuckets['1B+']++;
    } else {
      fundingBuckets['0']++;
    }

    if (metrics.valuation_usd) metricStats.with_valuation++;
    if (metrics.arr_usd) metricStats.with_arr++;
    if (metrics.revenue_usd) metricStats.with_revenue++;
    if (metrics.parsed_headcount) metricStats.with_headcount++;
    if (metrics.parsed_customers) metricStats.with_customers++;

    const hasTraction = metrics.arr_usd || metrics.revenue_usd || metrics.parsed_headcount || metrics.parsed_customers || metrics.parsed_users;
    if (hasTraction) metricStats.with_traction++;
    if (!metrics.last_round_amount_usd && !hasTraction) metricStats.no_metrics++;

    const fc = metrics.funding_confidence;
    if (fc === 0) confBuckets['none']++;
    else if (fc < 0.3) confBuckets['<0.3']++;
    else if (fc < 0.5) confBuckets['0.3-0.5']++;
    else if (fc < 0.7) confBuckets['0.5-0.7']++;
    else if (fc < 0.9) confBuckets['0.7-0.9']++;
    else confBuckets['0.9+']++;
  }

  if (dryRun) {
    console.log('  DRY RUN — not writing to database\n');
    printStats(results.length, domainStats, metricStats, roundTypeStats, fundingBuckets, confBuckets, results);
    return;
  }

  // ────── Batch update via exec_ddl ──────
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(results.length / BATCH_SIZE);

    const stmts = batch.map(({ startup, domain, metrics }) => {
      const esc = (s) => (s || '').replace(/'/g, "''");
      const nullOrStr = (v) => v ? `'${esc(v)}'` : 'NULL';
      const nullOrNum = (v) => v != null ? v : 'NULL';
      const metricsJson = metrics.startup_metrics
        ? `'${esc(JSON.stringify(metrics.startup_metrics))}'::jsonb`
        : 'NULL';

      return `UPDATE startup_uploads SET
        company_domain = ${nullOrStr(domain.company_domain)},
        company_domain_confidence = ${nullOrNum(domain.confidence)},
        domain_source = ${nullOrStr(domain.source)},
        startup_metrics = ${metricsJson},
        last_round_amount_usd = ${nullOrNum(metrics.last_round_amount_usd)},
        last_round_type = ${nullOrStr(metrics.last_round_type)},
        total_funding_usd = ${nullOrNum(metrics.total_funding_usd)},
        arr_usd = ${nullOrNum(metrics.arr_usd)},
        revenue_usd = ${nullOrNum(metrics.revenue_usd)},
        valuation_usd = ${nullOrNum(metrics.valuation_usd)},
        burn_monthly_usd = ${nullOrNum(metrics.burn_monthly_usd)},
        runway_months = ${nullOrNum(metrics.runway_months)},
        parsed_headcount = ${nullOrNum(metrics.parsed_headcount)},
        parsed_customers = ${nullOrNum(metrics.parsed_customers)},
        parsed_users = ${nullOrNum(metrics.parsed_users)},
        funding_confidence = ${nullOrNum(metrics.funding_confidence)},
        traction_confidence = ${nullOrNum(metrics.traction_confidence)},
        metrics_version = 'v1',
        metrics_parsed_at = NOW()
      WHERE id = '${startup.id}'`;
    }).join(';\n');

    const { data: batchResult, error: batchError } = await supabase.rpc('exec_ddl', { sql_text: stmts });
    if (batchError) {
      console.log(`   ❌ Batch ${batchNum}/${totalBatches}: ${batchError.message}`);
      errors += batch.length;
    } else if (batchResult && batchResult !== 'OK') {
      console.log(`   ⚠️  Batch ${batchNum}/${totalBatches}: ${batchResult}`);
      errors += batch.length;
    } else {
      applied += batch.length;
      process.stdout.write(`   ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} startups updated\n`);
    }
  }

  // ────── Summary ──────
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  BACKFILL v1 COMPLETE                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`  Total:   ${results.length}`);
  console.log(`  Applied: ${applied}`);
  console.log(`  Errors:  ${errors}`);

  printStats(results.length, domainStats, metricStats, roundTypeStats, fundingBuckets, confBuckets, results);
}

function printStats(total, domainStats, metricStats, roundTypeStats, fundingBuckets, confBuckets, results) {
  console.log('\n  ── Domain Source Distribution ──');
  for (const [src, cnt] of Object.entries(domainStats).sort((a, b) => b[1] - a[1])) {
    if (cnt === 0) continue;
    const pct = (cnt / total * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(cnt / total * 40));
    console.log(`    ${src.padEnd(28)} ${cnt.toString().padStart(5)} (${pct}%) ${bar}`);
  }

  console.log('\n  ── Metric Coverage ──');
  for (const [key, cnt] of Object.entries(metricStats).sort((a, b) => b[1] - a[1])) {
    const pct = (cnt / total * 100).toFixed(1);
    console.log(`    ${key.padEnd(20)} ${cnt.toString().padStart(5)} (${pct}%)`);
  }

  console.log('\n  ── Last Round Amount Distribution ──');
  for (const [bucket, cnt] of Object.entries(fundingBuckets)) {
    if (cnt === 0) continue;
    const pct = (cnt / total * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(cnt / total * 40));
    console.log(`    ${bucket.padEnd(14)} ${cnt.toString().padStart(5)} (${pct}%) ${bar}`);
  }

  console.log('\n  ── Round Type Distribution ──');
  for (const [rt, cnt] of Object.entries(roundTypeStats).sort((a, b) => b[1] - a[1])) {
    const pct = (cnt / total * 100).toFixed(1);
    console.log(`    ${rt.padEnd(16)} ${cnt.toString().padStart(5)} (${pct}%)`);
  }

  console.log('\n  ── Funding Confidence Distribution ──');
  for (const [bucket, cnt] of Object.entries(confBuckets)) {
    if (cnt === 0) continue;
    const pct = (cnt / total * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(cnt / total * 40));
    console.log(`    ${bucket.padEnd(10)} ${cnt.toString().padStart(5)} (${pct}%) ${bar}`);
  }

  // Top 20 by last round amount
  const withFunding = results.filter(r => r.metrics.last_round_amount_usd > 0)
    .sort((a, b) => b.metrics.last_round_amount_usd - a.metrics.last_round_amount_usd);
  if (withFunding.length > 0) {
    console.log('\n  ── Top 20 by Last Round Amount ──');
    for (let i = 0; i < Math.min(20, withFunding.length); i++) {
      const { startup, domain, metrics } = withFunding[i];
      const domStr = domain.company_domain ? ` (${domain.company_domain})` : '';
      const rtStr = metrics.last_round_type ? ` ${metrics.last_round_type}` : '';
      console.log(`    ${(i + 1).toString().padStart(3)}. ${(startup.name || '').substring(0, 35).padEnd(35)} ${formatAmount(metrics.last_round_amount_usd).padEnd(10)}${rtStr.padEnd(14)} conf=${metrics.funding_confidence}${domStr}`);
    }
  }

  console.log('');
}

main().catch(console.error);
