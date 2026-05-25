#!/usr/bin/env node
'use strict';

/**
 * GOD Data Gap Analysis — find missing fields suppressing GOD scores.
 *
 * Usage:
 *   node scripts/diagnostics/god-data-gaps.js
 *   node scripts/diagnostics/god-data-gaps.js --export=data/god-lift-queue.csv
 *   node scripts/diagnostics/god-data-gaps.js --top=100
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const topN = (() => {
  const a = args.find((x) => x.startsWith('--top='));
  return a ? parseInt(a.split('=')[1], 10) : 50;
})();
const exportPath = (() => {
  const a = args.find((x) => x.startsWith('--export='));
  return a ? path.resolve(a.split('=')[1]) : null;
})();

const SELECT = [
  'id', 'name', 'total_god_score', 'team_score', 'traction_score', 'market_score', 'product_score', 'vision_score',
  'pitch', 'description', 'tagline', 'website', 'sectors', 'stage', 'extracted_data',
  'team_size', 'team_size_estimate', 'customer_count', 'arr', 'mrr', 'revenue_annual',
  'latest_funding_amount', 'latest_funding_round', 'founders',
  'has_revenue', 'has_customers', 'is_launched', 'has_demo', 'growth_rate',
  'startup_metrics', 'last_round_amount_usd', 'arr_usd', 'revenue_usd', 'parsed_customers', 'parsed_headcount',
  'team_signals', 'execution_signals', 'metrics_parsed_at',
].join(',');

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 20;
}
function hasArr(v) {
  return Array.isArray(v) && v.length > 0;
}
function hasNum(v) {
  return v != null && v !== '' && Number(v) > 0;
}
function avg(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function godTier(g) {
  const n = Number(g) || 0;
  if (n < 50) return 'low';
  if (n < 70) return 'mid';
  return 'high';
}

const FIELD_CHECKS = {
  pitch: (s) => hasText(s.pitch),
  description: (s) => hasText(s.description),
  tagline: (s) => hasText(s.tagline),
  website: (s) => hasText(s.website),
  sectors: (s) => hasArr(s.sectors),
  stage: (s) => s.stage != null && s.stage !== '',
  founders: (s) =>
    hasArr(s.founders) ||
    (Array.isArray(s.extracted_data?.founders) && s.extracted_data.founders.length > 0),
  funding_any: (s) =>
    hasNum(s.latest_funding_amount) ||
    hasNum(s.last_round_amount_usd) ||
    hasNum(s.extracted_data?.latest_funding_amount) ||
    hasNum(s.extracted_data?.funding_amount),
  revenue_any: (s) =>
    hasNum(s.arr) || hasNum(s.mrr) || hasNum(s.revenue_annual) ||
    hasNum(s.arr_usd) || hasNum(s.revenue_usd) || s.has_revenue === true,
  customers_any: (s) =>
    hasNum(s.customer_count) || hasNum(s.parsed_customers) || s.has_customers === true,
  startup_metrics: (s) => !!(s.startup_metrics || s.metrics_parsed_at),
  is_launched: (s) => s.is_launched === true,
  has_demo: (s) => s.has_demo === true,
  team_signals: (s) => hasText(s.team_signals) || hasArr(s.extracted_data?.team_signals),
  execution_signals: (s) => hasText(s.execution_signals) || hasArr(s.extracted_data?.execution_signals),
};

async function fetchApproved() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('startup_uploads').select(SELECT).eq('status', 'approved').range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function pct(group, fn) {
  const hit = group.filter(fn).length;
  return { hit, miss: group.length - hit, pct: group.length ? Math.round((hit / group.length) * 1000) / 10 : 0 };
}

function liftScore(s) {
  let score = 0;
  if (!FIELD_CHECKS.stage(s)) score += 3;
  if (!FIELD_CHECKS.startup_metrics(s) && !FIELD_CHECKS.funding_any(s)) score += 3;
  if (!FIELD_CHECKS.revenue_any(s) && !FIELD_CHECKS.customers_any(s)) score += 3;
  if (!FIELD_CHECKS.is_launched(s)) score += 2;
  if (!FIELD_CHECKS.founders(s)) score += 2;
  if (!FIELD_CHECKS.pitch(s)) score += 1;
  if (!FIELD_CHECKS.website(s)) score += 1;
  if (Number(s.traction_score) < 35) score += 2;
  if (Number(s.total_god_score) < 50) score += 1;
  return score;
}

function missingFields(s) {
  return Object.entries(FIELD_CHECKS)
    .filter(([, fn]) => !fn(s))
    .map(([k]) => k);
}

async function main() {
  const all = await fetchApproved();
  const groups = { low: [], mid: [], high: [], all: all.filter((s) => s.total_god_score != null) };
  groups.all.forEach((s) => groups[godTier(s.total_god_score)].push(s));

  console.log('\n' + '='.repeat(72));
  console.log('  GOD DATA GAP ANALYSIS — what is suppressing scores?');
  console.log('='.repeat(72));
  console.log(`\nApproved startups:  ${all.length}`);
  console.log(`GOD < 50:           ${groups.low.length}  (avg ${avg(groups.low.map((s) => Number(s.total_god_score))).toFixed(1)})`);
  console.log(`GOD 50–69:          ${groups.mid.length}  (avg ${avg(groups.mid.map((s) => Number(s.total_god_score))).toFixed(1)})`);
  console.log(`GOD 70+:            ${groups.high.length}  (avg ${avg(groups.high.map((s) => Number(s.total_god_score))).toFixed(1)})`);

  console.log('\n── Component averages (bottleneck = traction on low tier) ──\n');
  for (const [tier, rows] of [['LOW', groups.low], ['MID', groups.mid], ['HIGH', groups.high]]) {
    const comps = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
    const line = comps.map((c) => `${c.replace('_score', '')}:${avg(rows.map((r) => Number(r[c] || 0))).toFixed(0)}`).join('  ');
    console.log(`  ${tier.padEnd(5)} ${line}`);
  }

  console.log('\n── Field coverage by GOD tier (% present) ──\n');
  console.log('  ' + 'Field'.padEnd(20) + 'ALL'.padStart(8) + '<50'.padStart(8) + '50-69'.padStart(8) + '70+'.padStart(8));
  for (const [name, fn] of Object.entries(FIELD_CHECKS)) {
    const a = pct(groups.all, fn);
    const l = pct(groups.low, fn);
    const m = pct(groups.mid, fn);
    const h = pct(groups.high, fn);
    console.log('  ' + name.padEnd(20) + `${a.pct}%`.padStart(8) + `${l.pct}%`.padStart(8) + `${m.pct}%`.padStart(8) + `${h.pct}%`.padStart(8));
  }

  console.log('\n── Biggest gaps on GOD < 50 (lift opportunity) ──\n');
  const gaps = Object.entries(FIELD_CHECKS)
    .map(([name, fn]) => {
      const miss = groups.low.filter((s) => !fn(s)).length;
      return { name, miss, pct: groups.low.length ? (miss / groups.low.length) * 100 : 0 };
    })
    .sort((a, b) => b.miss - a.miss);
  gaps.slice(0, 10).forEach((g) => {
    console.log(`  ${g.name.padEnd(18)} missing on ${g.miss}/${groups.low.length} (${g.pct.toFixed(1)}%)`);
  });

  const withMetrics = groups.all.filter((s) => FIELD_CHECKS.startup_metrics(s) || FIELD_CHECKS.funding_any(s));
  const withoutMetrics = groups.all.filter((s) => !FIELD_CHECKS.startup_metrics(s) && !FIELD_CHECKS.funding_any(s));
  console.log('\n── Parsed metrics correlation ──\n');
  console.log(`  With funding/metrics:    ${withMetrics.length} startups  avg GOD ${avg(withMetrics.map((s) => Number(s.total_god_score))).toFixed(1)}`);
  console.log(`  Without:               ${withoutMetrics.length} startups  avg GOD ${avg(withoutMetrics.map((s) => Number(s.total_god_score))).toFixed(1)}`);

  console.log('\n── Boolean flags (set these → immediate traction lift) ──\n');
  for (const f of ['has_revenue', 'has_customers', 'is_launched', 'has_demo']) {
    const yes = groups.all.filter((s) => s[f] === true);
    const no = groups.all.filter((s) => s[f] !== true);
    console.log(
      `  ${f.padEnd(16)} true=${String(yes.length).padStart(5)} avgGOD=${avg(yes.map((s) => Number(s.total_god_score))).toFixed(1)}` +
        `  |  unset=${String(no.length).padStart(5)} avgGOD=${avg(no.map((s) => Number(s.total_god_score))).toFixed(1)}`
    );
  }

  const queue = groups.low
    .map((s) => ({ ...s, liftScore: liftScore(s), missing: missingFields(s) }))
    .sort((a, b) => b.liftScore - a.liftScore || a.total_god_score - b.total_god_score);

  console.log(`\n── Top ${topN} lift candidates (GOD < 50, most missing high-impact fields) ──\n`);
  queue.slice(0, topN).forEach((s, i) => {
    console.log(
      `  ${String(i + 1).padStart(3)}. ${(s.name || 'unnamed').slice(0, 32).padEnd(32)} GOD=${String(s.total_god_score).padStart(2)}` +
        `  Tr=${String(s.traction_score ?? '-').padStart(2)}  missing: ${s.missing.slice(0, 5).join(', ')}`
    );
  });

  console.log('\n── Recommended lift pipeline (in order) ──\n');
  console.log('  1. Bridge tagline, pitch, website, founders from extracted_data:');
  console.log('       node scripts/enrich-god-hard-fields.js');
  console.log('  2. Parse metrics from text (funding, ARR, customers, stage):');
  console.log('       node scripts/backfill-startup-metrics.js');
  console.log('  3. Infer boolean flags (strict launch) + bridge parsed metrics:');
  console.log('       node scripts/infer-traction-flags.js');
  console.log('  4. Recalculate GOD scores (calibrated formula):');
  console.log('       node scripts/core/god-score-formula.js');
  console.log('  4. Re-sync signal scores with real GOD blend:');
  console.log('       node scripts/sync-signal-scores.js --apply');
  console.log('  5. Priority manual/AI enrichment for top queue:');
  console.log('       node scripts/enrich-startup-data.js --priority --top=50');
  console.log('');

  if (exportPath) {
    const header = 'id,name,total_god_score,traction_score,lift_score,missing_fields\n';
    const body = queue
      .slice(0, topN)
      .map((s) =>
        [s.id, JSON.stringify(s.name || ''), s.total_god_score, s.traction_score, s.liftScore, JSON.stringify(s.missing.join('|'))].join(',')
      )
      .join('\n');
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    fs.writeFileSync(exportPath, header + body + '\n');
    console.log(`Exported lift queue → ${exportPath}\n`);
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
