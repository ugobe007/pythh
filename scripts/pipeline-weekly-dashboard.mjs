#!/usr/bin/env node
/**
 * Weekly pipeline dashboard — startups, investors, enrichment, GOD, matches, learnings.
 *
 * Usage:
 *   node scripts/pipeline-weekly-dashboard.mjs
 *   node scripts/pipeline-weekly-dashboard.mjs --json
 *   node scripts/pipeline-weekly-dashboard.mjs --write   # saves reports/pipeline-weekly-YYYY-MM-DD.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
const require = createRequire(import.meta.url);
const { paginateStartupUploads } = require('../server/lib/supabaseClient.js');

const JSON_MODE = process.argv.includes('--json');
const WRITE = process.argv.includes('--write');
const root = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

async function count(table, filter) {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

/** Count with timeout fallback — full-table filters on 3M+ matches can 500. */
async function safeCount(table, filter, { fallback = 0, label } = {}) {
  try {
    return await count(table, filter);
  } catch (e) {
    if (label && !JSON_MODE) {
      console.warn(`  ⚠️  ${label}: count skipped (${e.message || 'timeout'})`);
    }
    return fallback;
  }
}

function startupNeedsEnrichment(r) {
  if (!r?.extracted_data) return true;
  const tier = r.extracted_data?.data_tier;
  if (tier === 'C') return true;
  if (tier !== 'A' && tier !== 'B') return true;
  if (typeof r.data_completeness === 'number' && r.data_completeness < 35) return true;
  return false;
}

async function main() {
  const generated_at = new Date().toISOString();
  const report = { generated_at, sections: {} };

  // ── Startups ──
  report.sections.startups = {
    total: await count('startup_uploads'),
    approved: await count('startup_uploads', (q) => q.eq('status', 'approved')),
    pending: await count('startup_uploads', (q) => q.eq('status', 'pending')),
    rejected: await count('startup_uploads', (q) => q.eq('status', 'rejected')),
    new_24h: await count('startup_uploads', (q) => q.gte('created_at', daysAgo(1))),
    new_7d: await count('startup_uploads', (q) => q.gte('created_at', daysAgo(7))),
    new_30d: await count('startup_uploads', (q) => q.gte('created_at', daysAgo(30))),
    new_7d_approved: await count('startup_uploads', (q) => q.gte('created_at', daysAgo(7)).eq('status', 'approved')),
    enrichment_holding: await count('startup_uploads', (q) => q.eq('status', 'approved').eq('enrichment_status', 'holding')),
    enrichment_waiting: await count('startup_uploads', (q) => q.eq('status', 'approved').eq('enrichment_status', 'waiting')),
    enrichment_null: await count('startup_uploads', (q) => q.eq('status', 'approved').is('enrichment_status', null)),
  };

  const allRows = await paginateStartupUploads(sb, 'extracted_data, data_completeness, status, enrichment_status', (q) => q);
  let needsEnrichment = 0;
  const byTier = { A: 0, B: 0, C: 0, unknown: 0 };
  for (const r of allRows) {
    const tier = r.extracted_data?.data_tier;
    if (tier === 'A') byTier.A += 1;
    else if (tier === 'B') byTier.B += 1;
    else if (tier === 'C') byTier.C += 1;
    else byTier.unknown += 1;
    if (startupNeedsEnrichment(r)) needsEnrichment += 1;
  }
  report.sections.startup_enrichment = {
    total_rows: allRows.length,
    needs_enrichment: needsEnrichment,
    needs_enrichment_pct: pct(needsEnrichment, allRows.length),
    by_tier: byTier,
  };

  // ── Investors ──
  report.sections.investors = {
    total: await count('investors'),
    verified: await count('investors', (q) => q.eq('is_verified', true)),
    new_7d: await count('investors', (q) => q.gte('created_at', daysAgo(7))),
    new_30d: await count('investors', (q) => q.gte('created_at', daysAgo(30))),
    missing_last_investment_date: await count('investors', (q) => q.is('last_investment_date', null)),
    missing_check_size: await count('investors', (q) => q.is('check_size_min', null).is('check_size_max', null)),
    missing_deployment_velocity: await count('investors', (q) => q.is('deployment_velocity_index', null)),
  };

  // ── GOD scores ──
  const approved = await paginateStartupUploads(
    sb,
    'total_god_score, team_score, traction_score, market_score, product_score, vision_score',
    (q) => q.eq('status', 'approved'),
  );
  const gods = approved.map((r) => r.total_god_score).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  const buckets = { '90+': 0, '80-89': 0, '70-79': 0, '60-69': 0, '50-59': 0, '40-49': 0, '<40': 0 };
  gods.forEach((s) => {
    if (s >= 90) buckets['90+']++;
    else if (s >= 80) buckets['80-89']++;
    else if (s >= 70) buckets['70-79']++;
    else if (s >= 60) buckets['60-69']++;
    else if (s >= 50) buckets['50-59']++;
    else if (s >= 40) buckets['40-49']++;
    else buckets['<40']++;
  });
  const subMeans = {};
  for (const k of ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score']) {
    const v = approved.map((r) => r[k]).filter((n) => typeof n === 'number' && n > 0);
    subMeans[k.replace('_score', '')] = Math.round(avg(v) * 10) / 10;
  }
  report.sections.god_scores = {
    approved_with_score: gods.length,
    mean: Math.round(avg(gods) * 10) / 10,
    median: gods[Math.floor(gods.length / 2)] ?? 0,
    p25: gods[Math.floor(gods.length * 0.25)] ?? 0,
    p75: gods[Math.floor(gods.length * 0.75)] ?? 0,
    at_floor_40: gods.filter((s) => s === 40).length,
    buckets,
    component_means: subMeans,
  };

  // ── Matches ──
  report.sections.matches = {
    total: await count('startup_investor_matches'),
    suggested: await count('startup_investor_matches', (q) => q.eq('status', 'suggested')),
    new_7d: await count('startup_investor_matches', (q) => q.gte('created_at', daysAgo(7))),
    new_30d: await count('startup_investor_matches', (q) => q.gte('created_at', daysAgo(30))),
    viewed: await safeCount('startup_investor_matches', (q) => q.not('viewed_at', 'is', null), { label: 'match viewed count' }),
    intro_requested: await safeCount('startup_investor_matches', (q) => q.not('intro_requested_at', 'is', null), { label: 'match intro count' }),
    contacted: await safeCount('startup_investor_matches', (q) => q.not('contacted_at', 'is', null), { label: 'match contacted count' }),
    feedback_true: await safeCount('startup_investor_matches', (q) => q.eq('feedback_received', true), { label: 'match feedback count' }),
  };

  const { data: mSample } = await sb
    .from('startup_investor_matches')
    .select('match_score, confidence_level, similarity_score, success_score, algorithm_version')
    .order('created_at', { ascending: false })
    .limit(5000);
  const ms = (mSample || []).map((r) => r.match_score).filter(Boolean);
  const scoreBuckets = { '85+': 0, '70-84': 0, '55-69': 0, '<55': 0 };
  ms.forEach((s) => {
    if (s >= 85) scoreBuckets['85+']++;
    else if (s >= 70) scoreBuckets['70-84']++;
    else if (s >= 55) scoreBuckets['55-69']++;
    else scoreBuckets['<55']++;
  });
  report.sections.match_quality_recent_5k = {
    avg_score: Math.round(avg(ms) * 10) / 10,
    min: ms.length ? Math.min(...ms) : null,
    max: ms.length ? Math.max(...ms) : null,
    buckets: scoreBuckets,
    avg_similarity: Math.round(avg((mSample || []).map((r) => r.similarity_score).filter(Boolean)) * 1000) / 1000,
    avg_success_score: Math.round(avg((mSample || []).map((r) => r.success_score).filter(Boolean)) * 1000) / 1000,
    algorithm_versions: [...new Set((mSample || []).map((r) => r.algorithm_version).filter(Boolean))],
  };

  // ── Learnings & recommended actions ──
  const eng = report.sections.startup_enrichment;
  const inv = report.sections.investors;
  const mt = report.sections.matches;
  report.learnings = [
    {
      id: 'enrichment_throughput',
      severity: eng.needs_enrichment_pct > 80 ? 'critical' : 'warn',
      observation: `${eng.needs_enrichment_pct}% of startups need enrichment (${eng.needs_enrichment}/${eng.total_rows}); ${report.sections.startups.enrichment_holding} holding, ${report.sections.startups.enrichment_waiting} waiting.`,
      action: 'Run npm run pipeline:enrich-priority weekly; target tier A/B on approved holding/waiting.',
    },
    {
      id: 'investor_recency',
      severity: inv.missing_last_investment_date / Math.max(inv.total, 1) > 0.7 ? 'critical' : 'warn',
      observation: `${inv.missing_last_investment_date}/${inv.total} investors missing last_investment_date; ${inv.missing_deployment_velocity} missing deployment_velocity_index.`,
      action: 'Run npm run pipeline:investor-intelligence to backfill signals + velocity.',
    },
    {
      id: 'engagement_blind',
      severity: mt.viewed === 0 && mt.total > 0 ? 'critical' : 'info',
      observation: `Match engagement: ${mt.viewed} viewed, ${mt.intro_requested} intros, ${mt.contacted} contacted, ${mt.feedback_true} with feedback.`,
      action: 'Engagement API live at POST /api/matches/engage — wire view/intro in site/ preview + match surfaces.',
    },
    {
      id: 'god_component_gap',
      severity: 'warn',
      observation: `GOD mean ${report.sections.god_scores.mean} vs component means ~${Math.round(avg(Object.values(subMeans)) * 10) / 10} — totals include bonus layers.`,
      action: 'Run npm run pipeline:god-audit; reject junk names at ingest.',
    },
    {
      id: 'match_ranking',
      severity: (report.sections.match_quality_recent_5k.algorithm_versions || []).includes('v3.3-pythh-recency')
        ? 'info'
        : 'warn',
      observation: `Recent match avg ${report.sections.match_quality_recent_5k.avg_score}; algorithms: ${(report.sections.match_quality_recent_5k.algorithm_versions || []).join(', ') || 'unknown'}.`,
      action: (report.sections.match_quality_recent_5k.algorithm_versions || []).includes('v3.3-pythh-recency')
        ? 'v3.3 recency applied — wire engagement API to measure intro/contact lift.'
        : 'Run node match-regenerator.js --full for v3.3-pythh-recency.',
    },
  ];

  report.health_grade =
    report.learnings.some((l) => l.severity === 'critical') ? 'NEEDS_ATTENTION' : 'OK';

  if (WRITE) {
    const dir = path.join(root, '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `pipeline-weekly-${generated_at.slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    if (!JSON_MODE) console.log(`\n📁 Wrote ${file}\n`);
  }

  // Refresh homepage stats cache (full-table counts — too slow per HTTP request)
  try {
    const { refreshPlatformStatsCache } = await import('./refresh-platform-stats-cache.mjs');
    await refreshPlatformStatsCache({ source: 'pipeline-weekly-dashboard' });
  } catch (e) {
    if (!JSON_MODE) console.warn(`  ⚠️  platform stats cache refresh skipped: ${e.message}`);
  }

  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  PYTHH PIPELINE WEEKLY DASHBOARD');
  console.log(`  ${generated_at.slice(0, 19)}Z  ·  grade: ${report.health_grade}`);
  console.log('══════════════════════════════════════════════════\n');

  console.log('STARTUPS');
  console.log(`  Total ${report.sections.startups.total.toLocaleString()} · approved ${report.sections.startups.approved.toLocaleString()}`);
  console.log(`  New 7d: ${report.sections.startups.new_7d.toLocaleString()} (${report.sections.startups.new_7d_approved} approved)`);
  console.log(`  Enrichment queue: ${report.sections.startups.enrichment_holding} holding · ${report.sections.startups.enrichment_waiting} waiting · ${report.sections.startups.enrichment_null} unset`);
  console.log(`  Needs enrichment: ${eng.needs_enrichment.toLocaleString()} (${eng.needs_enrichment_pct}%)\n`);

  console.log('INVESTORS');
  console.log(`  Total ${inv.total.toLocaleString()} · verified ${inv.verified}`);
  console.log(`  Missing last deal date: ${inv.missing_last_investment_date.toLocaleString()}`);
  console.log(`  Missing check size: ${inv.missing_check_size.toLocaleString()}\n`);

  console.log('GOD SCORES (approved)');
  console.log(`  Mean ${report.sections.god_scores.mean} · median ${report.sections.god_scores.median} · floor@40: ${report.sections.god_scores.at_floor_40}\n`);

  console.log('MATCHES');
  console.log(`  Total ${mt.total.toLocaleString()} · new 7d ${mt.new_7d.toLocaleString()}`);
  console.log(`  Engagement: viewed ${mt.viewed} · intro ${mt.intro_requested} · contacted ${mt.contacted} · feedback ${mt.feedback_true}`);
  console.log(`  Recent avg score: ${report.sections.match_quality_recent_5k.avg_score}\n`);

  console.log('LEARNINGS & ACTIONS');
  for (const l of report.learnings) {
    console.log(`  [${l.severity.toUpperCase()}] ${l.observation}`);
    console.log(`           → ${l.action}\n`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e.code || String(e));
  if (e.details) console.error('Details:', e.details);
  process.exit(1);
});
