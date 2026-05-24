#!/usr/bin/env node
/**
 * Infer traction boolean flags + bridge parsed metrics → GOD-scoring columns.
 *
 * Sets has_revenue, has_customers, is_launched from startup_metrics and parsed
 * columns. Also copies arr_usd → arr, parsed_customers → customer_count, etc.
 * when legacy columns are empty (god-score-formula reads arr/mrr/customer_count).
 *
 * Usage:
 *   node scripts/infer-traction-flags.js --dry-run
 *   node scripts/infer-traction-flags.js
 *   node scripts/infer-traction-flags.js --limit=500
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MIN_CONF = 0.4;
const BATCH_SIZE = 50;

const SELECT = [
  'id', 'name', 'website', 'pitch', 'description', 'tagline', 'extracted_data',
  'has_revenue', 'has_customers', 'is_launched', 'has_demo',
  'arr', 'mrr', 'revenue_annual', 'customer_count', 'team_size', 'team_size_estimate',
  'arr_usd', 'revenue_usd', 'parsed_customers', 'parsed_users', 'parsed_headcount',
  'last_round_amount_usd', 'latest_funding_amount', 'total_funding_usd',
  'startup_metrics', 'traction_confidence',
].join(', ');

function hasNum(v) {
  return v != null && v !== '' && Number(v) > 0;
}

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 20;
}

function getBestMention(metrics, type) {
  return metrics?.best_mentions?.[type] || null;
}

function inferTractionFlags(startup) {
  const ext = startup.extracted_data || {};
  const sm = startup.startup_metrics || {};
  const updates = {};
  const reasons = [];

  const arrMention = getBestMention(sm, 'arr');
  const revMention = getBestMention(sm, 'revenue');
  const mrrMention = getBestMention(sm, 'mrr');
  const custMention = getBestMention(sm, 'customers');
  const usersMention = getBestMention(sm, 'users');
  const hcMention = getBestMention(sm, 'headcount');

  const hasRevenueEvidence =
    hasNum(startup.arr_usd) ||
    hasNum(startup.revenue_usd) ||
    hasNum(startup.arr) ||
    hasNum(startup.mrr) ||
    hasNum(startup.revenue_annual) ||
    startup.has_revenue === true ||
    (arrMention?.amount_usd > 0 && arrMention.confidence >= MIN_CONF) ||
    (revMention?.amount_usd > 0 && revMention.confidence >= MIN_CONF) ||
    (mrrMention?.amount_usd > 0 && mrrMention.confidence >= MIN_CONF);

  if (hasRevenueEvidence && startup.has_revenue !== true) {
    updates.has_revenue = true;
    reasons.push('has_revenue');
  }

  if (!hasNum(startup.arr)) {
    if (hasNum(startup.arr_usd)) {
      updates.arr = Number(startup.arr_usd);
      reasons.push('arr←arr_usd');
    } else if (arrMention?.amount_usd > 0 && arrMention.confidence >= MIN_CONF) {
      updates.arr = Math.round(arrMention.amount_usd);
      reasons.push('arr←metrics');
    }
  }
  if (updates.arr && startup.has_revenue !== true) {
    updates.has_revenue = true;
    if (!reasons.includes('has_revenue')) reasons.push('has_revenue');
  }

  if (!hasNum(startup.mrr) && mrrMention?.amount_usd > 0 && mrrMention.confidence >= MIN_CONF) {
    updates.mrr = Math.round(mrrMention.amount_usd);
    reasons.push('mrr←metrics');
  }
  if (updates.mrr && startup.has_revenue !== true) {
    updates.has_revenue = true;
    if (!reasons.includes('has_revenue')) reasons.push('has_revenue');
  }

  const hasCustomerEvidence =
    hasNum(startup.customer_count) ||
    hasNum(startup.parsed_customers) ||
    hasNum(startup.parsed_users) ||
    startup.has_customers === true ||
    (custMention?.value > 0 && custMention.confidence >= MIN_CONF) ||
    (usersMention?.value > 0 && usersMention.confidence >= MIN_CONF);

  if (hasCustomerEvidence && startup.has_customers !== true) {
    updates.has_customers = true;
    reasons.push('has_customers');
  }

  if (!hasNum(startup.customer_count)) {
    const bridged =
      (hasNum(startup.parsed_customers) && Number(startup.parsed_customers)) ||
      (hasNum(startup.parsed_users) && Number(startup.parsed_users)) ||
      (custMention?.value > 0 && custMention.confidence >= MIN_CONF ? custMention.value : 0) ||
      (usersMention?.value > 0 && usersMention.confidence >= MIN_CONF ? usersMention.value : 0);
    if (hasNum(bridged)) {
      updates.customer_count = Math.round(bridged);
      reasons.push('customer_count←parsed');
    }
  }
  if (updates.customer_count && startup.has_customers !== true) {
    updates.has_customers = true;
    if (!reasons.includes('has_customers')) reasons.push('has_customers');
  }

  const hasWebsite = typeof startup.website === 'string' && startup.website.trim().length > 8;
  const hasFunding =
    hasNum(startup.last_round_amount_usd) ||
    hasNum(startup.latest_funding_amount) ||
    hasNum(startup.total_funding_usd);

  const hasLaunchedEvidence =
    startup.is_launched === true ||
    startup.has_demo === true ||
    !!ext.launched ||
    !!ext.has_demo ||
    ext.product !== undefined ||
    hasRevenueEvidence ||
    hasCustomerEvidence ||
    (hasFunding && hasWebsite);

  if (hasLaunchedEvidence && startup.is_launched !== true) {
    updates.is_launched = true;
    reasons.push('is_launched');
  }

  if (!hasNum(startup.team_size) && !hasNum(startup.team_size_estimate)) {
    if (hasNum(startup.parsed_headcount)) {
      updates.team_size = Number(startup.parsed_headcount);
      reasons.push('team_size←parsed_headcount');
    } else if (hcMention?.value > 0 && hcMention.confidence >= MIN_CONF) {
      updates.team_size = hcMention.value;
      reasons.push('team_size←metrics');
    }
  }

  return { updates, reasons };
}

async function fetchApproved(limit) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const to = limit ? Math.min(from + 999, limit - 1) : from + 999;
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(SELECT)
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000 || (limit && rows.length >= limit)) break;
  }
  return limit ? rows.slice(0, limit) : rows;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  INFER TRACTION FLAGS + METRIC BRIDGE                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`  Dry run: ${dryRun}`);
  if (limit) console.log(`  Limit:   ${limit}`);
  console.log('');

  const startups = await fetchApproved(limit);
  console.log(`📦 Loaded ${startups.length} approved startups\n`);

  const stats = {
    scanned: startups.length,
    changed: 0,
    has_revenue: 0,
    has_customers: 0,
    is_launched: 0,
    arr: 0,
    mrr: 0,
    customer_count: 0,
    team_size: 0,
    errors: 0,
  };

  const pending = [];

  for (const startup of startups) {
    const { updates, reasons } = inferTractionFlags(startup);
    if (Object.keys(updates).length === 0) continue;

    stats.changed++;
    for (const key of Object.keys(updates)) {
      if (stats[key] != null) stats[key]++;
    }

    pending.push({ id: startup.id, name: startup.name, updates, reasons });

    if (stats.changed <= 8) {
      console.log(`  → ${startup.name}: ${reasons.join(', ')}`);
    }
  }

  if (stats.changed > 8) {
    console.log(`  … and ${stats.changed - 8} more`);
  }

  if (!dryRun && pending.length > 0) {
    console.log(`\n💾 Applying ${pending.length} updates in batches of ${BATCH_SIZE}…\n`);
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ id, updates }) => {
          const { error } = await supabase.from('startup_uploads').update(updates).eq('id', id);
          if (error) stats.errors++;
        })
      );
      process.stdout.write(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pending.length / BATCH_SIZE)}\n`);
    }
  }

  console.log('\n── Summary ──');
  console.log(`  Scanned:        ${stats.scanned}`);
  console.log(`  Rows changed:   ${stats.changed}`);
  console.log(`  has_revenue:    +${stats.has_revenue}`);
  console.log(`  has_customers:  +${stats.has_customers}`);
  console.log(`  is_launched:    +${stats.is_launched}`);
  console.log(`  arr bridged:    ${stats.arr}`);
  console.log(`  mrr bridged:    ${stats.mrr}`);
  console.log(`  customer_count: ${stats.customer_count}`);
  console.log(`  team_size:      ${stats.team_size}`);
  if (!dryRun) console.log(`  Errors:         ${stats.errors}`);

  if (dryRun) {
    console.log('\n  DRY RUN — re-run without --dry-run to apply.');
  } else {
    console.log('\n  Next: node scripts/core/god-score-formula.js');
    console.log('        node scripts/sync-signal-scores.js --apply');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
