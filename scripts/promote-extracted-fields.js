#!/usr/bin/env node
'use strict';

/**
 * promote-extracted-fields.js
 *
 * PROBLEM:
 *   Scrapers and enrichment scripts write financial/metric data to three different
 *   locations — JSONB blobs, startup_metrics, extracted_data — but the signal
 *   pipeline (ingest-metrics-signals.js) only reads ROOT columns.
 *   Result: data exists in the database but is invisible to the pipeline.
 *
 * THIS SCRIPT:
 *   Promotes stranded JSONB values to canonical root columns.
 *   Never overwrites an existing non-null root value (promotes only where root IS NULL).
 *   Never aliases or bridges — writes to the one true column and stops.
 *
 * SOURCES → CANONICAL ROOT TARGETS:
 *   startup_metrics.best_mentions.last_round_amount.amount_usd  → latest_funding_amount
 *   extracted_data.funding_amount.value (× magnitude)           → latest_funding_amount
 *   extracted_data.funding_stage                                 → latest_funding_round
 *   extracted_data.growth_rate                                   → growth_rate
 *   extracted_data.customer_count                                → customer_count
 *   revenue_annual (legacy dup)                                  → revenue_usd
 *
 * DESIGN RULE:
 *   No new aliases. No bridge tables. Root column is the SSOT.
 *   After this script runs, future scrapers must write directly to root columns.
 *
 * Usage:
 *   node scripts/promote-extracted-fields.js              # dry run — shows what would change
 *   node scripts/promote-extracted-fields.js --apply      # writes to startup_uploads
 *   node scripts/promote-extracted-fields.js --apply --limit=2000
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const DRY  = !args.includes('--apply');
const LIMIT_ARG = (() => { const l = args.find(a => a.startsWith('--limit=')); return l ? parseInt(l.split('=')[1]) : null; })();
const PAGE = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MAGNITUDE = { k: 1_000, K: 1_000, m: 1_000_000, M: 1_000_000, b: 1_000_000_000, B: 1_000_000_000 };
const PG_INT_MAX = 2_147_483_647;

/**
 * Parse extracted_data.funding_amount object into a USD integer.
 *
 * Observed shapes:
 *   {raw:"5M",  value:5,         currency:"USD", magnitude:"M"}   → 5_000_000
 *   {raw:"$175000000", value:175000000}                            → 175_000_000
 *   {raw:"9 million",  value:9,  magnitude:"M"}                   → 9_000_000
 */
function parseFundingAmount(fa) {
  if (!fa) return null;
  if (typeof fa === 'number') return fa <= PG_INT_MAX ? Math.round(fa) : null;
  const mag = MAGNITUDE[fa.magnitude] ?? 1;
  const val = typeof fa.value === 'number' ? fa.value * mag : null;
  if (!val || val <= 0 || val > PG_INT_MAX) return null;
  return Math.round(val);
}

/**
 * Coerce a value to a positive finite integer within PG_INT_MAX.
 * Returns null if the value is invalid.
 */
function toSafeInt(v) {
  const n = parseFloat(v);
  if (!isFinite(n) || n <= 0 || n > PG_INT_MAX) return null;
  return Math.round(n);
}

/**
 * Fetch all rows from a Supabase query using .range() pagination.
 */
async function paginate(buildQuery, pageSize = PAGE) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) { console.error('Paginate error:', error.message); break; }
    if (!data || data.length === 0) break;
    rows.push(...data);
    process.stdout.write(`\r   Loaded: ${rows.length}…`);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

/**
 * Apply updates in batches of 50, in parallel groups of 10.
 * Each update = { id, fields: {...} }
 */
async function applyUpdates(updates, label) {
  if (DRY) {
    console.log(`   [DRY] Would update ${updates.length} rows for: ${label}`);
    return;
  }
  let ok = 0, fail = 0;
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    await Promise.all(slice.map(async ({ id, fields }) => {
      const { error } = await supabase.from('startup_uploads').update(fields).eq('id', id);
      if (error) { fail++; console.error(`\n   ✗ ${id}:`, error.message); }
      else ok++;
    }));
    process.stdout.write(`\r   ${label}: ${ok + fail}/${updates.length}…`);
  }
  console.log(`\r   ${label}: ✓ ${ok} updated, ✗ ${fail} failed`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION PASSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pass 1: startup_metrics.best_mentions.last_round_amount.amount_usd → latest_funding_amount
 *
 * startup-metric-parser.js mines descriptions for funding mentions and writes to
 * startup_metrics JSONB. ingest-metrics-signals.js reads root latest_funding_amount.
 * These never connected.
 */
async function passStartupMetricsFunding(allRows) {
  const updates = [];
  for (const r of allRows) {
    if (r.latest_funding_amount) continue; // root already populated — never overwrite
    const bm = r.startup_metrics?.best_mentions;
    if (!bm) continue;
    // Parser stores last_round_amount.amount_usd (also raw_mentions type='last_round_amount')
    const amount = bm.last_round_amount?.amount_usd ?? bm.last_round?.amount_usd ?? null;
    const safe = toSafeInt(amount);
    if (!safe) continue;
    const roundType = r.startup_metrics?.last_round_type || bm.last_round_amount?.round_type || null;
    const fields = { latest_funding_amount: safe };
    if (roundType && !r.latest_funding_round) fields.latest_funding_round = roundType;
    updates.push({ id: r.id, fields, _dbg: { name: r.name, amount: safe, source: 'startup_metrics' } });
  }
  console.log(`\n  Pass 1 (startup_metrics → latest_funding_amount): ${updates.length} rows`);
  if (DRY && updates.length > 0) {
    for (const u of updates.slice(0, 5)) console.log(`   ${u._dbg.name}: $${u._dbg.amount.toLocaleString()}`);
    if (updates.length > 5) console.log(`   … and ${updates.length - 5} more`);
  }
  await applyUpdates(updates, 'startup_metrics → latest_funding_amount');
  return updates.length;
}

/**
 * Pass 2: extracted_data.funding_amount → latest_funding_amount
 *
 * ssot-rss-scraper.js writes funding_amount as a JSONB object to extracted_data.
 * This was never promoted to the root numeric column.
 */
async function passExtractedFundingAmount(allRows) {
  const updates = [];
  for (const r of allRows) {
    if (r.latest_funding_amount) continue; // already set (possibly by pass 1)
    const fa = r.extracted_data?.funding_amount;
    if (!fa) continue;
    const safe = parseFundingAmount(fa);
    if (!safe) continue;
    const stage = r.extracted_data?.funding_stage || null;
    const fields = { latest_funding_amount: safe };
    if (stage && !r.latest_funding_round) fields.latest_funding_round = stage;
    updates.push({ id: r.id, fields, _dbg: { name: r.name, amount: safe, raw: fa.raw, source: 'extracted_data.funding_amount' } });
  }
  console.log(`\n  Pass 2 (extracted_data.funding_amount → latest_funding_amount): ${updates.length} rows`);
  if (DRY && updates.length > 0) {
    for (const u of updates.slice(0, 5)) console.log(`   ${u._dbg.name}: $${u._dbg.amount.toLocaleString()} (raw: ${u._dbg.raw})`);
    if (updates.length > 5) console.log(`   … and ${updates.length - 5} more`);
  }
  await applyUpdates(updates, 'extracted_data.funding_amount → latest_funding_amount');
  return updates.length;
}

/**
 * Pass 3: extracted_data.growth_rate → growth_rate
 *
 * ssot-rss-scraper.js sometimes writes growth_rate into extracted_data (as a
 * percentage string or number). root growth_rate is 0% populated despite having data.
 */
async function passExtractedGrowthRate(allRows) {
  const updates = [];
  for (const r of allRows) {
    if (r.growth_rate !== null && r.growth_rate !== undefined) continue;
    const edGrowth = r.extracted_data?.growth_rate;
    if (edGrowth === null || edGrowth === undefined) continue;
    const safe = toSafeInt(edGrowth);
    if (!safe || safe > 10000) continue; // cap at 10,000% — outliers are bad data
    updates.push({ id: r.id, fields: { growth_rate: safe }, _dbg: { name: r.name, val: safe } });
  }
  console.log(`\n  Pass 3 (extracted_data.growth_rate → growth_rate): ${updates.length} rows`);
  if (DRY && updates.length > 0) {
    for (const u of updates.slice(0, 5)) console.log(`   ${u._dbg.name}: ${u._dbg.val}%`);
  }
  await applyUpdates(updates, 'extracted_data.growth_rate → growth_rate');
  return updates.length;
}

/**
 * Pass 4: extracted_data.customer_count → customer_count
 *
 * Scrapers write customer_count to extracted_data but the root column stays null.
 *
 * SANITY BOUNDS (added 2026-04-01):
 *   Auto-ingested records (source_type != 'manual') are capped at 500,000 customers.
 *   Values above this almost always come from pattern extractors misreading API call
 *   counts, website visitor stats, or "users" claims that are not actual paying customers.
 *   Manual records (human-verified) are allowed up to 10M.
 *   Any value above the cap is logged and skipped — not silently promoted.
 */
const CUSTOMER_CAP_AUTO   = 500_000;   // for rss / url / discovered sources
const CUSTOMER_CAP_MANUAL = 10_000_000; // for human-entered records

async function passExtractedCustomerCount(allRows) {
  const updates = [];
  const skipped = [];
  for (const r of allRows) {
    if (r.customer_count) continue;
    const edCC = r.extracted_data?.customer_count;
    if (!edCC) continue;
    const safe = toSafeInt(edCC);
    if (!safe) continue;
    const isManual = r.source_type === 'manual';
    const cap = isManual ? CUSTOMER_CAP_MANUAL : CUSTOMER_CAP_AUTO;
    if (safe > cap) {
      skipped.push({ name: r.name, val: safe, src: r.source_type, cap });
      continue;
    }
    updates.push({ id: r.id, fields: { customer_count: safe }, _dbg: { name: r.name, val: safe } });
  }
  console.log(`\n  Pass 4 (extracted_data.customer_count → customer_count): ${updates.length} rows`);
  if (skipped.length > 0) {
    console.log(`  ⚠️  SKIPPED ${skipped.length} implausible values (above cap):`);
    skipped.slice(0, 10).forEach(s => console.log(`     ${s.name}: ${s.val.toLocaleString()} customers (src: ${s.src}, cap: ${s.cap.toLocaleString()})`));
  }
  if (DRY && updates.length > 0) {
    for (const u of updates.slice(0, 5)) console.log(`   ${u._dbg.name}: ${u._dbg.val} customers`);
  }
  await applyUpdates(updates, 'extracted_data.customer_count → customer_count');
  return updates.length;
}

/**
 * Pass 5: revenue_annual → revenue_usd   (legacy column dedup)
 *
 * revenue_annual is the old column name. revenue_usd is the canonical name.
 * Promote where revenue_usd is NULL and revenue_annual has a value.
 */
async function passRevenueAnnualToUsd(allRows) {
  const updates = [];
  for (const r of allRows) {
    if (r.revenue_usd) continue;
    const val = toSafeInt(r.revenue_annual);
    if (!val) continue;
    updates.push({ id: r.id, fields: { revenue_usd: val }, _dbg: { name: r.name, val } });
  }
  console.log(`\n  Pass 5 (revenue_annual → revenue_usd): ${updates.length} rows`);
  if (DRY && updates.length > 0) {
    for (const u of updates.slice(0, 5)) console.log(`   ${u._dbg.name}: $${u._dbg.val.toLocaleString()}`);
  }
  await applyUpdates(updates, 'revenue_annual → revenue_usd');
  return updates.length;
}

/**
 * Pass 6: arr → arr_usd   (legacy column dedup)
 *
 * arr is the old column name. arr_usd is the canonical name.
 */
async function passArrToArrUsd(allRows) {
  const updates = [];
  for (const r of allRows) {
    if (r.arr_usd) continue;
    const val = toSafeInt(r.arr);
    if (!val) continue;
    updates.push({ id: r.id, fields: { arr_usd: val }, _dbg: { name: r.name, val } });
  }
  console.log(`\n  Pass 6 (arr → arr_usd): ${updates.length} rows`);
  if (DRY && updates.length > 0) {
    for (const u of updates.slice(0, 5)) console.log(`   ${u._dbg.name}: $${u._dbg.val.toLocaleString()}`);
  }
  await applyUpdates(updates, 'arr → arr_usd');
  return updates.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📤  promote-extracted-fields  ${DRY ? '(DRY RUN)' : '(APPLY)'}\n`);
  console.log('  Promotes stranded JSONB data to canonical root columns in startup_uploads.');
  console.log('  Never overwrites existing root values. Writes once — no aliases.\n');

  // Load all rows that could have relevant data
  // We load broadly then filter per-pass to avoid multiple round trips.
  console.log('  Loading startup_uploads rows with extracted_data OR startup_metrics…');
  const rows = await paginate((from, to) =>
    supabase
      .from('startup_uploads')
      .select(`
        id, name,
        latest_funding_amount, latest_funding_round,
        arr_usd, arr,
        revenue_usd, revenue_annual,
        growth_rate, growth_rate_monthly,
        customer_count,
        extracted_data,
        startup_metrics
      `)
      .or('extracted_data.not.is.null,startup_metrics.not.is.null')
      .range(from, to)
  );
  console.log(`\r  Loaded ${rows.length} rows with extracted_data or startup_metrics\n`);

  const allRows = LIMIT_ARG ? rows.slice(0, LIMIT_ARG) : rows;

  // ── Run all passes ────────────────────────────────────────────────────────
  // Note: pass 2 checks latest_funding_amount AFTER pass 1 may have set it in
  // memory, but since we filter by the DB value (r.latest_funding_amount from
  // the initial fetch), both passes may overlap on the same row if pass 1 sets
  // it in DB but allRows still shows null. This is safe — pass 2 will also
  // promote on the same row in that edge case, which is idempotent.
  //
  // If running --apply multiple times: on re-run, root columns will be populated
  // from pass 1 output so pass 2 will correctly skip those rows.

  let total = 0;
  total += await passStartupMetricsFunding(allRows);
  total += await passExtractedFundingAmount(allRows);
  total += await passExtractedGrowthRate(allRows);
  total += await passExtractedCustomerCount(allRows);
  total += await passRevenueAnnualToUsd(allRows);
  total += await passArrToArrUsd(allRows);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n  ─────────────────────────────────────────────');
  if (DRY) {
    console.log(`  DRY RUN — ${total} rows would be updated across 6 passes.`);
    console.log('  Re-run with --apply to commit.\n');
    console.log('  After applying, run:');
    console.log('    node scripts/ingest-metrics-signals.js --apply');
    console.log('    node scripts/sync-signal-scores.js --apply\n');
  } else {
    console.log(`  ✓ ${total} rows promoted across 6 passes.`);
    console.log('\n  Next steps:');
    console.log('    node scripts/ingest-metrics-signals.js --apply');
    console.log('    node scripts/sync-signal-scores.js --apply\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
