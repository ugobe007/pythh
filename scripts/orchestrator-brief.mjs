#!/usr/bin/env node
/**
 * Daily orchestrator brief — weakest funnel stage + active mandate for LLM agents.
 *
 * Usage:
 *   node scripts/orchestrator-brief.mjs
 *   node scripts/orchestrator-brief.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as dotenv from 'dotenv';

dotenv.config();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const date = new Date().toISOString().slice(0, 10);

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function latestFunnelReport() {
  const dir = path.join(repoRoot, 'reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('conversion-funnel-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length ? readJson(path.join(dir, files[0])) : null;
}

function rate(num, denom) {
  if (!denom) return null;
  return Math.round((num / denom) * 1000) / 10;
}

function buildOrchestratorRates(funnel) {
  const rates = funnel?.rates || {};
  const s = funnel?.stages || {};
  const signups =
    (s.founder_signup_completed_all ?? s.founder_signup_completed ?? 0) +
    (s.investor_signup_completed ?? 0);
  const previewViews = s.instant_matches_viewed || 0;
  const previewDenom = previewViews || s.preview_requested || 0;

  return {
    ...rates,
    url_submitted_per_page_view: rate(s.url_submitted, s.page_view),
    preview_per_url_submitted: rates.preview_view_per_url ?? rate(previewViews, s.url_submitted),
    signup_per_preview: rates.signup_per_preview ?? rate(signups, previewDenom),
    first_match_per_signup: rate(s.match_viewed, signups),
    return_7d: rates.return_visit_per_preview ?? rate(s.return_visit_7d, previewViews),
    checkout_per_pricing_view: rates.checkout_per_pricing ?? rate(s.checkout_started, s.pricing_viewed),
  };
}

function weakestStage(funnel) {
  const rates = buildOrchestratorRates(funnel);
  const stages = [
    { id: 'awareness', label: 'Awareness / traffic', rate: rates.url_submitted_per_page_view, problem: 'Almost no one discovers Pythh — outbound and SEO are underpowered.' },
    { id: 'preview', label: 'Visit → preview', rate: rates.preview_per_url_submitted, problem: 'URLs submitted but preview not viewed — hero/preview path is leaking.' },
    { id: 'signup', label: 'Preview → signup', rate: rates.signup_per_preview, problem: 'Founders see value then leave — gate, CTA, or trust gap.' },
    { id: 'use', label: 'Signup → first use', rate: rates.first_match_per_signup, problem: 'Accounts created but no match engagement — activation failure.' },
    { id: 'return', label: 'Return visit', rate: rates.return_7d, problem: 'No addiction loop — one-and-done visits.' },
    { id: 'pay', label: 'Use → paid', rate: rates.checkout_per_pricing_view, problem: 'Pricing/checkout path unproven or uninstrumented.' },
  ];

  const scored = stages
    .map((s) => ({
      ...s,
      score: s.rate == null ? -1 : s.rate,
    }))
    .sort((a, b) => a.score - b.score);

  const worst = scored.find((s) => s.score >= 0) || scored[0];
  return worst;
}

function pickLoopsForStage(stageId) {
  const byStage = {
    awareness: ['outbound_find_investors', 'share_proof_cards', 'seo_find_investors'],
    preview: ['preview_cliffhanger', 'match_explain', 'preview_evidence_strip'],
    signup: ['preview_cliffhanger', 'oracle_gap_gate', 'founder_gate_cta'],
    use: ['match_explain', 'wizard_progression', 'intro_funnel'],
    return: ['signal_delta', 'investor_movement_digest', 'founder_match_nudges'],
    pay: ['pricing_oracle_bridge', 'trial_first_cta', 'checkout_recovery'],
  };
  return byStage[stageId] || [
    'preview_cliffhanger',
    'signal_delta',
    'investor_movement_digest',
    'match_explain',
    'outbound_find_investors',
  ];
}

function main() {
  spawnSync(process.execPath, ['scripts/conversion-funnel-snapshot.mjs', '--json'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  const funnel = latestFunnelReport();
  const weak = weakestStage(funnel);
  const northStar = readJson(path.join(repoRoot, 'agents/north-star.json'));

  const brief = {
    date,
    mandate: 'active_not_passive',
    voice: {
      ratio: '40% picky/skeptical critique, 60% motivating actionable logic',
      rule: 'Prove with evidence; show what fails fit; end with one clear next step.',
    },
    north_star: {
      goal: northStar?.goal,
      gap_signups_per_day:
        funnel?.north_star_gap?.signups_per_day ??
        (northStar?.metrics?.primary === 'total_signups_per_day'
          ? Math.max(0, (northStar?.targets?.signups_per_day ?? 100) - (funnel?.totals?.signups_per_day ?? 0))
          : null),
    },
    funnel_snapshot: {
      window_days: funnel?.window_days ?? 7,
      stages: funnel?.stages ?? {},
      conversion_rates: buildOrchestratorRates(funnel),
    },
    weakest_stage: weak,
    todays_focus: {
      primary: weak?.problem || 'Close preview→signup leak and instrument every stage.',
      required_output: 'At least ONE active_engagement item (outbound, in-product loop, or new instrumentation)',
      loops_to_consider: pickLoopsForStage(weak?.id),
      agent_priorities: funnel?.agent_priorities ?? [],
    },
    banned_passivity: [
      'Monitor only — no shippable change',
      'Generic copy advice without variant + file path',
      'Pipeline polish with no user-facing engagement',
    ],
    read_first: ['agents/ORCHESTRATOR.md', 'agents/north-star.json'],
  };

  const outDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `orchestrator-brief-${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(brief, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(brief, null, 2));
  } else {
    console.log('\n🎯 Orchestrator brief');
    console.log(`   Weakest stage: ${weak?.label} (${weak?.score ?? 'unknown'}%)`);
    console.log(`   Focus: ${brief.todays_focus.primary}`);
    console.log(`   Written: ${outFile}\n`);
  }
}

main();
