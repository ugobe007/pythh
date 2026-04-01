#!/usr/bin/env node
'use strict';

/**
 * ingest-metrics-signals.js
 *
 * Converts structured numeric fields from startup_uploads into high-confidence
 * signal events. This is the most reliable signal source we have — actual numbers
 * reported by the company or extracted from Crunchbase/LinkedIn.
 *
 * Why this matters:
 *   Text parsing catches fundraising/acquisition (because headlines announce them).
 *   Numbers catch everything else: growth, revenue, traction, hiring, burn.
 *   Without this, signal diversity is artificially skewed toward deal signals.
 *
 * Signal classes generated:
 *   revenue_signal        — from arr, mrr, arr_usd, revenue_usd (> 0)
 *   growth_signal         — from arr_growth_rate, growth_rate_monthly (exceptional)
 *   demand_signal         — from customer_count, customer_growth_monthly
 *   hiring_signal         — from team_size, parsed_headcount
 *   fundraising_signal    — from total_funding_usd, latest_funding_amount
 *   distress_signal       — from burn_monthly_usd, runway_months (low)
 *   efficiency_signal     — from ltv_cac_ratio, nrr (strong unit economics)
 *   product_signal        — from features_shipped_last_month, days_from_idea_to_mvp
 *   expansion_signal      — from customer_growth_monthly (exceptional)
 *
 * Usage:
 *   node scripts/ingest-metrics-signals.js --dry-run
 *   node scripts/ingest-metrics-signals.js --apply
 *   node scripts/ingest-metrics-signals.js --apply --limit 500
 *   node scripts/ingest-metrics-signals.js --apply --since 7    # only rows updated in last 7 days
 */

import { createClient }  from '@supabase/supabase-js';
import dotenv            from 'dotenv';

dotenv.config();

// ── CLI args ──────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const APPLY  = args.includes('--apply');
const DRY    = !APPLY;
const LIMIT  = +(args.find(a => a.startsWith('--limit='))?.split('=')[1]
             ?? args[args.indexOf('--limit') + 1]
             ?? 2000);
const SINCE_DAYS = +(args.find(a => a.startsWith('--since='))?.split('=')[1]
                  ?? args[args.indexOf('--since') + 1]
                  ?? 0);

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Metric → Signal Conversion Rules ─────────────────────────────────────────
//
// Each rule: { field, test, signal, strength, confidence, meaning, description }
// The `test` function returns true when the metric is signal-worthy.
// Rules are ordered by specificity (more specific = higher priority).
//
// Thresholds are based on SaaS benchmarks:
//   ARR > $1M = notable revenue signal
//   ARR growth > 100% YoY = exceptional growth
//   NRR > 120% = strong expansion
//   LTV:CAC > 3x = healthy unit economics
//   Runway < 6 months = distress
//   Team > 50 = established scale (not early-stage hiring signal)

const METRIC_RULES = [

  // ── Revenue ───────────────────────────────────────────────────────────────
  {
    field: 'arr_usd', label: 'ARR (USD)',
    test: v => v > 0,
    tier: v => v >= 10_000_000 ? { strength: 0.95, conf: 0.97, meaning: `$${fmt(v)} ARR — significant revenue milestone` }
             : v >=  1_000_000 ? { strength: 0.85, conf: 0.95, meaning: `$${fmt(v)} ARR — past $1M milestone` }
             : v >=    100_000 ? { strength: 0.72, conf: 0.93, meaning: `$${fmt(v)} ARR — early revenue traction` }
             :                   { strength: 0.55, conf: 0.90, meaning: `$${fmt(v)} ARR — pre-seed revenue` },
    signal_class: 'revenue_signal', action_tag: 'action_growing',
  },
  {
    field: 'mrr', label: 'MRR',
    test: v => v > 0,
    tier: v => v >= 500_000  ? { strength: 0.95, conf: 0.97, meaning: `$${fmt(v)}/mo MRR — Series B+ revenue profile` }
             : v >= 100_000  ? { strength: 0.88, conf: 0.95, meaning: `$${fmt(v)}/mo MRR — growth-stage revenue` }
             : v >= 10_000   ? { strength: 0.72, conf: 0.93, meaning: `$${fmt(v)}/mo MRR — early recurring revenue` }
             :                 { strength: 0.55, conf: 0.90, meaning: `$${fmt(v)}/mo MRR — early traction` },
    signal_class: 'revenue_signal', action_tag: 'action_growing',
  },
  {
    field: 'revenue_usd', label: 'Revenue (USD)',
    test: v => v > 0,
    tier: v => ({ strength: Math.min(0.95, 0.60 + v / 10_000_000 * 0.35), conf: 0.92, meaning: `$${fmt(v)} revenue` }),
    signal_class: 'revenue_signal', action_tag: 'action_growing',
  },

  // ── Growth ────────────────────────────────────────────────────────────────
  {
    field: 'arr_growth_rate', label: 'ARR Growth Rate (%)',
    test: v => v > 0,
    tier: v => v >= 300 ? { strength: 0.97, conf: 0.90, meaning: `${v}% ARR growth — hypergrowth signal` }
             : v >= 100 ? { strength: 0.90, conf: 0.88, meaning: `${v}% ARR growth — exceptional growth` }
             : v >= 50  ? { strength: 0.80, conf: 0.85, meaning: `${v}% ARR growth — strong growth` }
             :             { strength: 0.65, conf: 0.80, meaning: `${v}% ARR growth — steady growth` },
    signal_class: 'growth_signal', action_tag: 'action_growing',
  },
  {
    field: 'growth_rate_monthly', label: 'Monthly Growth Rate (%)',
    test: v => v > 0,
    tier: v => v >= 20  ? { strength: 0.95, conf: 0.88, meaning: `${v}%/mo growth — hypergrowth` }
             : v >= 10  ? { strength: 0.85, conf: 0.85, meaning: `${v}%/mo growth — strong momentum` }
             : v >= 5   ? { strength: 0.70, conf: 0.82, meaning: `${v}%/mo growth — healthy growth` }
             :             { strength: 0.50, conf: 0.75, meaning: `${v}%/mo growth — early growth` },
    signal_class: 'growth_signal', action_tag: 'action_growing',
  },
  {
    field: 'customer_growth_monthly', label: 'Customer Growth Rate (%/mo)',
    test: v => v > 0,
    tier: v => v >= 20 ? { strength: 0.93, conf: 0.88, meaning: `${v}%/mo customer growth — rapid expansion` }
             : v >= 10 ? { strength: 0.82, conf: 0.85, meaning: `${v}%/mo customer growth — accelerating` }
             :            { strength: 0.65, conf: 0.80, meaning: `${v}%/mo customer growth — growing` },
    signal_class: v => v >= 15 ? 'expansion_signal' : 'growth_signal',
    action_tag: 'action_growing',
  },

  // ── Traction / Demand ─────────────────────────────────────────────────────
  {
    field: 'customer_count', label: 'Customer Count',
    test: v => v > 0,
    tier: v => v >= 1000 ? { strength: 0.95, conf: 0.93, meaning: `${v}+ customers — established demand` }
             : v >= 100  ? { strength: 0.85, conf: 0.90, meaning: `${v} customers — significant traction` }
             : v >= 10   ? { strength: 0.72, conf: 0.88, meaning: `${v} customers — validated demand` }
             :              { strength: 0.58, conf: 0.85, meaning: `${v} customer(s) — early traction` },
    signal_class: 'demand_signal', action_tag: 'action_growing',
  },
  {
    field: 'parsed_customers', label: 'Parsed Customer Count',
    test: v => v > 0,
    tier: v => v >= 1000 ? { strength: 0.90, conf: 0.88, meaning: `${v}+ customers (parsed)` }
             : v >= 100  ? { strength: 0.80, conf: 0.85, meaning: `${v} customers (parsed)` }
             :              { strength: 0.60, conf: 0.80, meaning: `${v} customers (parsed)` },
    signal_class: 'demand_signal', action_tag: 'action_growing',
  },
  {
    field: 'nps_score', label: 'NPS Score',
    test: v => v !== null && v !== undefined,
    tier: v => v >= 60 ? { strength: 0.88, conf: 0.85, meaning: `NPS ${v} — world-class customer love` }
             : v >= 40 ? { strength: 0.75, conf: 0.82, meaning: `NPS ${v} — strong product-market fit` }
             : v >= 20 ? { strength: 0.60, conf: 0.78, meaning: `NPS ${v} — solid user satisfaction` }
             :            { strength: 0.40, conf: 0.75, meaning: `NPS ${v} — improvement needed` },
    signal_class: v => v >= 40 ? 'demand_signal' : 'buyer_pain_signal',
    action_tag: 'action_growing',
  },

  // ── Hiring / Team ─────────────────────────────────────────────────────────
  {
    field: 'parsed_headcount', label: 'Team Size (Parsed)',
    test: v => v >= 2,   // solo founder is not a hiring signal
    tier: v => v >= 200 ? { strength: 0.88, conf: 0.90, meaning: `${v}-person team — established org` }
             : v >= 50  ? { strength: 0.80, conf: 0.88, meaning: `${v}-person team — scaling org` }
             : v >= 15  ? { strength: 0.70, conf: 0.85, meaning: `${v}-person team — growing team` }
             : v >= 5   ? { strength: 0.60, conf: 0.82, meaning: `${v}-person team — early team` }
             :             { strength: 0.45, conf: 0.78, meaning: `${v}-person founding team` },
    signal_class: v => v >= 50 ? 'expansion_signal' : 'hiring_signal',
    action_tag: 'action_hiring',
  },
  {
    field: 'team_size', label: 'Team Size (Reported)',
    test: v => v >= 2,   // solo founder is not a hiring signal
    tier: v => v >= 200 ? { strength: 0.85, conf: 0.88, meaning: `${v}-person team` }
             : v >= 50  ? { strength: 0.78, conf: 0.85, meaning: `${v}-person team` }
             : v >= 15  ? { strength: 0.68, conf: 0.82, meaning: `${v}-person team — building org` }
             :             { strength: 0.52, conf: 0.78, meaning: `${v}-person team` },
    signal_class: v => v >= 50 ? 'expansion_signal' : 'hiring_signal',
    action_tag: 'action_hiring',
  },
  {
    field: 'features_shipped_last_month', label: 'Features Shipped / Month',
    test: v => v > 0,
    tier: v => v >= 10 ? { strength: 0.88, conf: 0.85, meaning: `${v} features/month — rapid product velocity` }
             : v >= 5  ? { strength: 0.78, conf: 0.82, meaning: `${v} features/month — strong product velocity` }
             :            { strength: 0.65, conf: 0.78, meaning: `${v} features/month — active product development` },
    signal_class: 'product_signal', action_tag: 'action_launching',
  },

  // ── Funding ───────────────────────────────────────────────────────────────
  {
    field: 'total_funding_usd', label: 'Total Funding (USD)',
    test: v => v > 0 && v < 100_000_000_000,  // sanity cap: >$100B is clearly bad data
    tier: v => v >= 50_000_000 ? { strength: 0.95, conf: 0.97, meaning: `$${fmt(v)} total funding — well-capitalized` }
             : v >= 10_000_000 ? { strength: 0.90, conf: 0.95, meaning: `$${fmt(v)} total funding — Series A+` }
             : v >=  1_000_000 ? { strength: 0.82, conf: 0.93, meaning: `$${fmt(v)} total funding — seed-funded` }
             :                   { strength: 0.70, conf: 0.90, meaning: `$${fmt(v)} total funding — pre-seed` },
    signal_class: 'fundraising_signal', action_tag: 'action_closing_round',
  },
  {
    field: 'latest_funding_amount', label: 'Latest Round Amount',
    test: v => v > 0 && v < 5_000_000_000,   // sanity cap: >$5B is bad data
    tier: v => v >= 20_000_000 ? { strength: 0.97, conf: 0.97, meaning: `$${fmt(v)} latest round — growth capital` }
             : v >=  5_000_000 ? { strength: 0.90, conf: 0.95, meaning: `$${fmt(v)} latest round` }
             :                   { strength: 0.80, conf: 0.92, meaning: `$${fmt(v)} latest round` },
    signal_class: 'fundraising_signal', action_tag: 'action_closing_round',
  },

  // ── Unit Economics ────────────────────────────────────────────────────────
  {
    field: 'ltv_cac_ratio', label: 'LTV:CAC Ratio',
    test: v => v > 0,
    tier: v => v >= 5   ? { strength: 0.92, conf: 0.90, meaning: `LTV:CAC ${v.toFixed(1)}x — exceptional unit economics` }
             : v >= 3   ? { strength: 0.80, conf: 0.88, meaning: `LTV:CAC ${v.toFixed(1)}x — healthy unit economics` }
             : v >= 1.5 ? { strength: 0.62, conf: 0.82, meaning: `LTV:CAC ${v.toFixed(1)}x — improving unit economics` }
             :             { strength: 0.42, conf: 0.75, meaning: `LTV:CAC ${v.toFixed(1)}x — unit economics concern` },
    signal_class: v => v >= 3 ? 'efficiency_signal' : 'buyer_pain_signal',
    action_tag: 'action_growing',
  },
  {
    field: 'nrr', label: 'Net Revenue Retention (%)',
    test: v => v > 0,
    tier: v => v >= 130 ? { strength: 0.95, conf: 0.90, meaning: `${v}% NRR — best-in-class expansion revenue` }
             : v >= 110 ? { strength: 0.85, conf: 0.88, meaning: `${v}% NRR — strong net dollar retention` }
             : v >= 90  ? { strength: 0.70, conf: 0.82, meaning: `${v}% NRR — stable retention` }
             :             { strength: 0.50, conf: 0.75, meaning: `${v}% NRR — churn concern` },
    signal_class: v => v >= 110 ? 'expansion_signal' : (v >= 90 ? 'efficiency_signal' : 'distress_signal'),
    action_tag: 'action_growing',
  },

  // ── Distress ──────────────────────────────────────────────────────────────
  {
    field: 'runway_months', label: 'Runway (Months)',
    test: v => v !== null && v !== undefined && v > 0,
    tier: v => v <= 3  ? { strength: 0.95, conf: 0.92, meaning: `${v} months runway — critical distress signal` }
             : v <= 6  ? { strength: 0.85, conf: 0.88, meaning: `${v} months runway — urgent fundraise needed` }
             : v <= 12 ? { strength: 0.65, conf: 0.80, meaning: `${v} months runway — fundraise cycle approaching` }
             :            { strength: 0.40, conf: 0.70, meaning: `${v} months runway — adequate` },
    signal_class: v => v <= 6 ? 'distress_signal' : 'fundraising_signal',
    action_tag: v => v <= 6 ? 'action_survival' : 'action_exploring',
  },
  {
    field: 'burn_monthly_usd', label: 'Monthly Burn (USD)',
    test: v => v > 0,
    tier: v => v >= 500_000 ? { strength: 0.85, conf: 0.88, meaning: `$${fmt(v)}/mo burn — high burn rate` }
             : v >= 100_000 ? { strength: 0.70, conf: 0.82, meaning: `$${fmt(v)}/mo burn — moderate burn` }
             :                 { strength: 0.50, conf: 0.75, meaning: `$${fmt(v)}/mo burn — lean operations` },
    // Burn alone is ambiguous — combine with runway for distress context
    signal_class: 'efficiency_signal', action_tag: 'action_growing',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

function resolveSignalClass(rule, value) {
  return typeof rule.signal_class === 'function' ? rule.signal_class(value) : rule.signal_class;
}

function resolveActionTag(rule, value) {
  return typeof rule.action_tag === 'function' ? rule.action_tag(value) : rule.action_tag;
}

/**
 * Convert a startup_upload row into signal events.
 * Returns array of signal objects ready to insert into pythh_signal_events.
 */
function extractMetricSignals(row, entityId, now) {
  const signals = [];

  for (const rule of METRIC_RULES) {
    const raw = row[rule.field];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (isNaN(value) || !rule.test(value)) continue;

    const t          = rule.tier(value);
    const sigClass   = resolveSignalClass(rule, value);
    const action_tag = resolveActionTag(rule, value);

    signals.push({
      entity_id:       entityId,
      primary_signal:  sigClass,
      signal_type:     'metric_derived',
      action_tag,
      // raw_sentence stores the metric description for dedup and display
      raw_sentence:    `[metric] ${rule.label}: ${value} — ${t.meaning}`,
      raw_context:     `Structured metric field: ${rule.field}`,
      confidence:      +t.conf.toFixed(3),
      signal_strength: +t.strength.toFixed(3),
      evidence_quality: 'confirmed',   // structured numbers = confirmed
      source:          'structured_metrics',
      source_type:     'structured_metrics',
      source_reliability: 0.95,        // matches SOURCE_RELIABILITY.structured_metrics
      detected_at:     now,
      is_ambiguous:    false,
      is_multi_signal: false,
      has_negation:    false,
    });
  }

  return signals;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n[ingest-metrics-signals] ${DRY ? '── DRY RUN ──' : '── APPLY ──'}`);
  console.log(`  limit=${LIMIT}${SINCE_DAYS ? `  since=${SINCE_DAYS}d` : '  all time'}\n`);

  // Step 1: Fetch entities that have startup_upload_id links
  // This is the authoritative direction — start from known entity↔upload pairs.
  let entQ = supabase
    .from('pythh_entities')
    .select('id, startup_upload_id')
    .not('startup_upload_id', 'is', null)
    .eq('is_active', true)
    .limit(LIMIT);

  if (SINCE_DAYS > 0) {
    const cutoff = new Date(Date.now() - SINCE_DAYS * 86400000).toISOString();
    entQ = entQ.gte('updated_at', cutoff);
  }

  const { data: entityLinks, error: entErr } = await entQ;
  if (entErr) { console.error('Failed to fetch entities:', entErr.message); process.exit(1); }
  console.log(`  Found ${entityLinks.length} linked entities\n`);

  if (entityLinks.length === 0) {
    console.log('  No linked entities found — run ingest-pythh-signals.js first to create entity links.');
    process.exit(0);
  }

  // Build entity id lookup from upload id
  const entityByUploadId = {};
  for (const e of entityLinks) entityByUploadId[e.startup_upload_id] = e.id;

  // Step 2: Fetch the startup_uploads for those entity-linked IDs (in chunks)
  const uploadIds = entityLinks.map(e => e.startup_upload_id);
  // Chunk size kept at 100 to stay under PostgREST URL length limits
  const CHUNK = 100;
  const uploads = [];
  for (let i = 0; i < uploadIds.length; i += CHUNK) {
    const chunk = uploadIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(`
        id, name,
        arr, mrr, arr_usd, revenue_usd, arr_growth_rate, growth_rate_monthly,
        customer_count, parsed_customers, customer_growth_monthly,
        nps_score, features_shipped_last_month,
        total_funding_usd, latest_funding_amount,
        ltv_cac_ratio, nrr, burn_monthly_usd, runway_months,
        team_size, parsed_headcount
      `)
      .in('id', chunk);
    if (error) { console.error(`Chunk ${i} error:`, error.message); continue; }
    uploads.push(...(data || []));
  }
  console.log(`  Fetched ${uploads.length} startup_uploads metric rows\n`);

  const now = new Date().toISOString();

  // ── Idempotency guard: skip entities that already have metric signals today ──
  // This prevents duplicate signals on re-runs within the same UTC day.
  const today = now.slice(0, 10); // YYYY-MM-DD
  const alreadyIngestedToday = new Set();
  if (!DRY) {
    const entityIdList = Object.values(entityByUploadId);
    for (let i = 0; i < entityIdList.length; i += 100) {
      const { data: existing } = await supabase
        .from('pythh_signal_events')
        .select('entity_id')
        .in('entity_id', entityIdList.slice(i, i + 100))
        .eq('source_type', 'structured_metrics')
        .gte('detected_at', `${today}T00:00:00Z`);
      for (const r of (existing || [])) alreadyIngestedToday.add(r.entity_id);
    }
    if (alreadyIngestedToday.size > 0) {
      console.log(`  ⏭  ${alreadyIngestedToday.size} entities already have metric signals today — skipping them\n`);
    }
  }

  let totalSignals = 0, entitiesProcessed = 0, entitiesSkipped = 0;

  const classCounts = {};
  const signalBuf = [];

  for (const row of uploads) {
    // Resolve entity ID via startup_upload_id (primary link)
    const entityId = entityByUploadId[row.id];

    if (!entityId) {
      entitiesSkipped++;
      continue;
    }

    // Skip if already ingested today (idempotency guard)
    if (!DRY && alreadyIngestedToday.has(entityId)) {
      entitiesSkipped++;
      continue;
    }

    const sigs = extractMetricSignals(row, entityId, now);
    if (sigs.length === 0) continue;

    entitiesProcessed++;
    totalSignals += sigs.length;

    for (const s of sigs) {
      classCounts[s.primary_signal] = (classCounts[s.primary_signal] || 0) + 1;
    }

    if (DRY) {
      if (entitiesProcessed <= 5) {
        console.log(`  [DRY] ${row.name} (${entityId.slice(0,8)}) → ${sigs.length} signals:`);
        for (const s of sigs) {
          console.log(`    ${s.primary_signal.padEnd(25)} conf=${s.confidence} | ${s.raw_sentence}`);
        }
      }
    } else {
      signalBuf.push(...sigs);
      // Flush in batches of 200
      if (signalBuf.length >= 200) {
        const { error } = await supabase
          .from('pythh_signal_events')
          .insert(signalBuf);
        if (error) console.error('  Batch insert error:', error.message);
        else process.stdout.write('.');
        signalBuf.length = 0;
      }
    }
  }

  // Flush remainder
  if (!DRY && signalBuf.length > 0) {
    const { error } = await supabase
      .from('pythh_signal_events')
      .insert(signalBuf);
    if (error) console.error('  Final batch insert error:', error.message);
    else process.stdout.write('.\n');
  }

  console.log(`\n  Results:`);
  console.log(`    Entities matched:  ${entitiesProcessed}`);
  console.log(`    Entities skipped:  ${entitiesSkipped} (no entity match)`);
  console.log(`    Signals generated: ${totalSignals}`);
  console.log(`\n  Signal class breakdown:`);
  for (const [cls, n] of Object.entries(classCounts).sort((a,b) => b[1]-a[1])) {
    console.log(`    ${n.toString().padStart(5)}  ${cls}`);
  }

  if (DRY) {
    console.log(`\n  → Run with --apply to write to DB`);
  } else {
    console.log(`\n  ✓ Done`);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
