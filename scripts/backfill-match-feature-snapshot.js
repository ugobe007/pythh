#!/usr/bin/env node
/**
 * Backfill feature_snapshot for historical startup_investor_matches using current
 * startup_uploads + investors (approximation — not identical to original generation).
 *
 *   node scripts/backfill-match-feature-snapshot.js --dry-run --limit=500
 *   node scripts/backfill-match-feature-snapshot.js --apply --limit=2000
 */

require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { buildMatchFeatureSnapshot } = require('../lib/matchFeatureSnapshot');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function parseArgs(argv) {
  const out = { apply: false, limit: 500, batch: 40 };
  for (const a of argv) {
    if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') out.apply = false;
    else if (a.startsWith('--limit=')) out.limit = Math.max(1, parseInt(a.slice('--limit='.length), 10) || 500);
    else if (a.startsWith('--batch=')) out.batch = Math.max(5, parseInt(a.slice('--batch='.length), 10) || 40);
  }
  return out;
}

function startupPayload(row) {
  if (!row) return {};
  return {
    id: row.id,
    sectors: row.sectors,
    stage: row.stage,
    total_god_score: row.total_god_score,
    team_score: row.team_score,
    traction_score: row.traction_score,
    market_score: row.market_score,
    product_score: row.product_score,
    vision_score: row.vision_score,
    maturity_level: row.maturity_level,
    data_completeness: row.data_completeness,
    has_revenue: !!row.has_revenue,
    has_customers: !!row.has_customers,
    is_launched: !!row.is_launched,
    mrr: row.mrr,
    arr: row.arr,
    customer_count: row.customer_count,
    growth_rate_monthly: row.growth_rate_monthly,
  };
}

function investorPayload(row) {
  if (!row) return {};
  return {
    id: row.id,
    sectors: row.sectors,
    stage: row.stage,
    check_size_min: row.check_size_min,
    check_size_max: row.check_size_max,
    geography_focus: row.geography_focus,
    investor_score: row.investor_score,
    investor_tier: row.investor_tier,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: matches, error } = await supabase
    .from('startup_investor_matches')
    .select('id, startup_id, investor_id')
    .is('feature_snapshot', null)
    .order('created_at', { ascending: false })
    .limit(args.limit);

  if (error) throw new Error(error.message);
  const list = matches || [];
  console.error(`Found ${list.length} rows without feature_snapshot (limit ${args.limit})`);

  let updated = 0;
  for (let i = 0; i < list.length; i += args.batch) {
    const slice = list.slice(i, i + args.batch);
    const suIds = [...new Set(slice.map((r) => r.startup_id))];
    const invIds = [...new Set(slice.map((r) => r.investor_id))];

    const { data: suRows } = await supabase
      .from('startup_uploads')
      .select(
        'id, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score, maturity_level, data_completeness, has_revenue, has_customers, is_launched, mrr, arr, customer_count, growth_rate_monthly',
      )
      .in('id', suIds);
    const { data: invRows } = await supabase
      .from('investors')
      .select(
        'id, sectors, stage, check_size_min, check_size_max, geography_focus, investor_score, investor_tier',
      )
      .in('id', invIds);

    const suMap = new Map((suRows || []).map((r) => [r.id, r]));
    const invMap = new Map((invRows || []).map((r) => [r.id, r]));

    for (const m of slice) {
      const snap = buildMatchFeatureSnapshot({
        engine: 'backfill_current_row',
        phase: 'approximation',
        startup: startupPayload(suMap.get(m.startup_id)),
        investor: investorPayload(invMap.get(m.investor_id)),
      });
      if (args.apply) {
        const { error: upErr } = await supabase
          .from('startup_investor_matches')
          .update({ feature_snapshot: snap })
          .eq('id', m.id);
        if (upErr) console.error(`Update ${m.id}: ${upErr.message}`);
        else updated++;
      } else {
        updated++;
      }
    }
  }

  console.error(args.apply ? `Updated ${updated} rows.` : `Dry-run: would update ${updated} rows. Use --apply.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
