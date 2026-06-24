#!/usr/bin/env node
/**
 * 7-day growth cycle — compare variants and recommend traffic reallocation.
 *
 * Usage:
 *   npm run growth:cycle
 *   npm run growth:cycle -- --days=7 --apply   # write registry if decision=REALLOCATE
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { loadRegistry, syncRegistryToDb } = require('../server/lib/growthExperiments.js');

const JSON_OUT = process.argv.includes('--json');
const APPLY = process.argv.includes('--apply');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;
const MIN_EVENTS = 20;
const MIN_COMPLETIONS = 3;
const WIN_MARGIN = 0.2;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(repoRoot, 'reports');

function isProbe(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return Boolean(payload.probe_run_id || payload.source === 'funnel_probe');
}

function rate(num, denom) {
  if (!denom) return null;
  return Math.round((num / denom) * 1000) / 10;
}

function compareVariants(rows, { startedEvent, completedEvent }) {
  const byKey = {};
  for (const r of rows) {
    if (!byKey[r.variant_key]) {
      byKey[r.variant_key] = { started: 0, completed: 0, probe_started: 0, probe_completed: 0 };
    }
    const probe = isProbe(r.payload);
    if (r.event_name === startedEvent) {
      byKey[r.variant_key].started += 1;
      if (probe) byKey[r.variant_key].probe_started += 1;
    }
    if (r.event_name === completedEvent) {
      byKey[r.variant_key].completed += 1;
      if (probe) byKey[r.variant_key].probe_completed += 1;
    }
  }

  const variants = Object.entries(byKey).map(([key, v]) => ({
    variant_key: key,
    started: v.started,
    completed: v.completed,
    started_organic: v.started - v.probe_started,
    completed_organic: v.completed - v.probe_completed,
    completion_rate: rate(v.completed - v.probe_completed, v.started - v.probe_started),
  }));

  const organicStarted = variants.reduce((s, v) => s + v.started_organic, 0);
  const organicCompleted = variants.reduce((s, v) => s + v.completed_organic, 0);

  let winner = null;
  let loser = null;
  let decision = 'HOLD';
  let reason = '';

  const eligible = variants.filter((v) => v.started_organic >= 5);
  if (organicStarted < MIN_EVENTS) {
    reason = `Insufficient organic volume (${organicStarted} starts, need ${MIN_EVENTS})`;
  } else if (organicCompleted < MIN_COMPLETIONS) {
    reason = `No completion signal (${organicCompleted} organic completions, need ${MIN_COMPLETIONS} to reallocate)`;
  } else {
    const sorted = [...eligible].sort((a, b) => (b.completion_rate ?? 0) - (a.completion_rate ?? 0));
    winner = sorted[0];
    loser = sorted[sorted.length - 1];
    if (winner && loser && winner.variant_key !== loser.variant_key) {
      const w = winner.completion_rate ?? 0;
      const l = loser.completion_rate ?? 0;
      if (l === 0 ? w > 0 : w >= l * (1 + WIN_MARGIN)) {
        decision = 'REALLOCATE';
        reason = `${winner.variant_key} completion ${w}% vs ${loser.variant_key} ${l}%`;
      } else {
        reason = `No clear winner (margin < ${WIN_MARGIN * 100}%)`;
      }
    }
  }

  return { variants, organicStarted, organicCompleted, winner, loser, decision, reason };
}

function compareGateCta(rows) {
  const filtered = rows.filter((r) => r.event_name === 'founder_signup_started');
  const byKey = {};
  for (const r of filtered) {
    if (!byKey[r.variant_key]) byKey[r.variant_key] = { clicks: 0, organic: 0, probe: 0 };
    byKey[r.variant_key].clicks += 1;
    if (isProbe(r.payload)) byKey[r.variant_key].probe += 1;
    else byKey[r.variant_key].organic += 1;
  }

  const variants = Object.entries(byKey).map(([key, v]) => ({
    variant_key: key,
    gate_clicks: v.clicks,
    organic_clicks: v.organic,
  }));

  const organicTotal = variants.reduce((s, v) => s + v.organic_clicks, 0);
  let winner = null;
  let decision = 'HOLD';
  let reason = '';

  if (organicTotal < 10) {
    reason = `Insufficient organic gate clicks (${organicTotal}, need 10)`;
  } else {
    const sorted = [...variants].sort((a, b) => b.organic_clicks - a.organic_clicks);
    winner = sorted[0];
    const runner = sorted[1];
    if (winner && runner && winner.organic_clicks >= runner.organic_clicks * (1 + WIN_MARGIN)) {
      decision = 'REALLOCATE';
      reason = `${winner.variant_key} leads organic gate clicks ${winner.organic_clicks} vs ${runner.organic_clicks}`;
    } else {
      reason = 'Gate CTA split inconclusive';
    }
  }

  return { variants, organicTotal, winner, decision, reason };
}

function applyInvestorReallocation(registry, winnerKey) {
  const exp = registry.experiments.find((e) => e.id === 'investor_signup_schema');
  if (!exp) return false;
  for (const v of exp.variants) {
    v.traffic_pct = v.key === winnerKey ? 70 : 15;
  }
  registry.updated_at = new Date().toISOString();
  return true;
}

function comparePricingOracle(rows) {
  const filtered = rows.filter((r) => r.event_name === 'checkout_started');
  const byKey = {};
  for (const r of filtered) {
    if (!byKey[r.variant_key]) byKey[r.variant_key] = { clicks: 0, organic: 0, probe: 0 };
    byKey[r.variant_key].clicks += 1;
    if (isProbe(r.payload)) byKey[r.variant_key].probe += 1;
    else byKey[r.variant_key].organic += 1;
  }

  const variants = Object.entries(byKey).map(([key, v]) => ({
    variant_key: key,
    checkout_clicks: v.clicks,
    organic_clicks: v.organic,
  }));

  const organicTotal = variants.reduce((s, v) => s + v.organic_clicks, 0);
  let winner = null;
  let decision = 'HOLD';
  let reason = '';

  if (organicTotal < 10) {
    reason = `Insufficient organic pricing checkout clicks (${organicTotal}, need 10)`;
  } else {
    const sorted = [...variants].sort((a, b) => b.organic_clicks - a.organic_clicks);
    winner = sorted[0];
    const runner = sorted[1];
    if (winner && runner && winner.organic_clicks >= runner.organic_clicks * (1 + WIN_MARGIN)) {
      decision = 'REALLOCATE';
      reason = `${winner.variant_key} leads organic checkout clicks ${winner.organic_clicks} vs ${runner.organic_clicks}`;
    } else {
      reason = 'Pricing Oracle CTA split inconclusive';
    }
  }

  return { variants, organicTotal, winner, decision, reason };
}

function applyPricingOracleReallocation(registry, winnerKey) {
  const exp = registry.experiments.find((e) => e.id === 'pricing_oracle_cta');
  if (!exp) return false;
  for (const v of exp.variants) {
    v.traffic_pct = v.key === winnerKey ? 80 : 20;
  }
  registry.updated_at = new Date().toISOString();
  return true;
}
function applyGateCtaReallocation(registry, winnerKey) {
  const exp = registry.experiments.find((e) => e.id === 'founder_preview_gate_cta');
  if (!exp) return false;
  for (const v of exp.variants) {
    v.traffic_pct = v.key === winnerKey ? 80 : 20;
  }
  registry.updated_at = new Date().toISOString();
  return true;
}

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: events, error } = await sb
    .from('growth_experiment_events')
    .select('experiment_id, variant_key, event_name, payload, created_at')
    .gte('created_at', since);
  if (error) throw error;

  const investorRows = (events || []).filter((e) => e.experiment_id === 'investor_signup_schema');
  const gateRows = (events || []).filter((e) => e.experiment_id === 'founder_preview_gate_cta');
  const pricingRows = (events || []).filter((e) => e.experiment_id === 'pricing_oracle_cta');

  const investor = compareVariants(investorRows, {
    startedEvent: 'investor_signup_started',
    completedEvent: 'investor_signup_completed',
  });

  const gateCta = compareGateCta(gateRows);
  const pricingOracle = comparePricingOracle(pricingRows);

  const registry = loadRegistry();
  const actions = [];

  if (investor.decision === 'REALLOCATE' && investor.winner) {
    actions.push({
      experiment: 'investor_signup_schema',
      action: 'reallocate',
      winner: investor.winner.variant_key,
      new_split: { winner: 70, others: 15 },
    });
    if (APPLY) applyInvestorReallocation(registry, investor.winner.variant_key);
  }

  if (gateCta.decision === 'REALLOCATE' && gateCta.winner) {
    actions.push({
      experiment: 'founder_preview_gate_cta',
      action: 'reallocate',
      winner: gateCta.winner.variant_key,
      new_split: { winner: 80, loser: 20 },
    });
    if (APPLY) applyGateCtaReallocation(registry, gateCta.winner.variant_key);
  }

  if (pricingOracle.decision === 'REALLOCATE' && pricingOracle.winner) {
    actions.push({
      experiment: 'pricing_oracle_cta',
      action: 'reallocate',
      winner: pricingOracle.winner.variant_key,
      new_split: { winner: 80, loser: 20 },
    });
    if (APPLY) applyPricingOracleReallocation(registry, pricingOracle.winner.variant_key);
  }

  if (APPLY && actions.length) {
    const regPath = path.join(repoRoot, 'agents/growth/experiment-registry.json');
    fs.writeFileSync(regPath, `${JSON.stringify(registry, null, 2)}\n`);
    await syncRegistryToDb(sb);
  }

  const report = {
    generated_at: new Date().toISOString(),
    window_days: days,
    decisions: {
      founder_preview_gate_cta: {
        ...gateCta,
        decision: gateCta.decision,
        recommendation:
          gateCta.decision === 'REALLOCATE'
            ? `Shift traffic to ${gateCta.winner?.variant_key} (80/20)`
            : 'Keep 50/50 — collect more organic gate clicks',
      },
      pricing_oracle_cta: {
        ...pricingOracle,
        decision: pricingOracle.decision,
        recommendation:
          pricingOracle.decision === 'REALLOCATE'
            ? `Shift traffic to ${pricingOracle.winner?.variant_key} (80/20)`
            : 'Keep 50/50 — collect more organic pricing checkout clicks',
      },
      investor_signup_schema: {
        ...investor,
        decision: investor.decision,
        recommendation:
          investor.decision === 'REALLOCATE'
            ? `Shift traffic to ${investor.winner?.variant_key} (70/15/15)`
            : 'Keep 33/33/34 — email-first has not proven completion lift yet',
      },
    },
    actions_taken: APPLY ? actions : [],
    apply_mode: APPLY,
    executive_summary: [
      `Gate CTA (${days}d): ${gateCta.reason}`,
      `Pricing Oracle CTA (${days}d): ${pricingOracle.reason}`,
      `Investor signup (${days}d): ${investor.reason}`,
      actions.length
        ? `Applied ${actions.length} reallocation(s) to registry`
        : 'No traffic reallocation — thresholds not met or no completion winner',
      `Organic investor starts: ${investor.organicStarted}, completions: ${investor.organicCompleted}`,
      `Organic gate clicks: ${gateCta.organicTotal}`,
    ],
  };

  fs.mkdirSync(reportsDir, { recursive: true });
  const outFile = path.join(reportsDir, `growth-cycle-${report.generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n📈 Growth cycle decision (${days}d)\n`);
    console.log('founder_preview_gate_cta:', report.decisions.founder_preview_gate_cta.decision);
    console.log('  ', report.decisions.founder_preview_gate_cta.recommendation);
    console.log('pricing_oracle_cta:', report.decisions.pricing_oracle_cta.decision);
    console.log('  ', report.decisions.pricing_oracle_cta.recommendation);
    console.log('investor_signup_schema:', report.decisions.investor_signup_schema.decision);
    console.log('  ', report.decisions.investor_signup_schema.recommendation);
    if (actions.length && APPLY) console.log('\n✅ Registry updated + synced');
    else if (actions.length) console.log('\n⚠️  Reallocation recommended — re-run with --apply to commit');
    console.log(`\n📁 ${outFile}\n`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
