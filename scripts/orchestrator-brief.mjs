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
import { loadOrchestratorPersona } from './lib/orchestratorPersona.mjs';

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
  const hf = funnel?.human_funnel || {};
  const signups =
    (s.founder_signup_completed_all ?? s.founder_signup_completed ?? 0) +
    (s.investor_signup_completed ?? 0);
  const previewViews = (s.instant_matches_viewed_ui ?? hf.instant_matches_viewed ?? s.instant_matches_viewed) || 0;
  const humanUrlSubmitted = s.url_submitted_human ?? hf.url_submitted ?? s.url_submitted ?? 0;
  const humanPageViews = hf.page_view ?? s.page_view ?? 0;
  const previewDenom = previewViews || s.preview_requested || 0;

  return {
    ...rates,
    url_submitted_per_page_view: rates.url_submitted_per_page_view ?? rate(humanUrlSubmitted, humanPageViews),
    preview_per_url_submitted: rates.preview_view_per_human_url ?? rates.preview_per_url_submitted ?? rate(previewViews, humanUrlSubmitted),
    preview_per_page_view: rates.preview_view_per_page_view ?? rate(previewViews, humanPageViews),
    signup_per_preview: rates.signup_per_preview ?? rate(signups, previewDenom),
    first_match_per_signup: rate(s.match_viewed, signups),
    return_7d: rates.return_visit_per_preview ?? rate(s.return_visit_7d, previewViews),
    checkout_per_pricing_view: rates.checkout_per_pricing ?? rate(s.checkout_started, s.pricing_viewed),
  };
}

const PAGE_VIEW_FLOOR_7D = 20;
/** Conservative daily human page views needed to support ~1 signup/day at early funnel conversion. */
const TRAFFIC_TARGET_PER_DAY = 50;

function awarenessTrafficScore(humanPageViews, windowDays) {
  const perDay = humanPageViews / Math.max(windowDays || 7, 1);
  if (perDay <= 0) return 0;
  return Math.min(99, Math.round((perDay / TRAFFIC_TARGET_PER_DAY) * 100));
}

function buildFunnelBlindFlags(funnel, rates) {
  const s = funnel?.stages || {};
  const hf = funnel?.human_funnel || {};
  const humanPageViews = hf.page_view ?? s.page_view ?? 0;
  const humanUrlSubmitted = s.url_submitted_human ?? hf.url_submitted ?? 0;
  const urlPerPv = rates.url_submitted_per_page_view;
  const previewViews = (s.instant_matches_viewed_ui ?? hf.instant_matches_viewed ?? s.instant_matches_viewed) || 0;

  const awarenessBlind =
    humanPageViews <= PAGE_VIEW_FLOOR_7D ||
    humanUrlSubmitted < 1 ||
    (urlPerPv != null && urlPerPv > 100);
  const previewBlind = awarenessBlind || previewViews < 5;
  const signupBlind = previewBlind || previewViews < 5;

  return {
    awareness: awarenessBlind,
    preview: previewBlind,
    signup: signupBlind,
    human_page_views_7d: humanPageViews,
    human_url_submitted_7d: humanUrlSubmitted,
    preview_views_7d: previewViews,
    url_submitted_per_page_view: urlPerPv,
    note: 'BLIND stages are uncomputable — do not ship UI loops targeting them until instrumented.',
  };
}

function weakestStage(funnel, northStar) {
  const rates = buildOrchestratorRates(funnel);
  const s = funnel?.stages || {};
  const hf = funnel?.human_funnel || {};
  const windowDays = funnel?.window_days ?? 7;
  const humanPageViews = hf.page_view ?? s.page_view ?? 0;
  const humanPageViewsPerDay = Math.round((humanPageViews / windowDays) * 10) / 10;
  const urlPerPv = rates.url_submitted_per_page_view;
  const previewViews = (s.instant_matches_viewed_ui ?? hf.instant_matches_viewed ?? s.instant_matches_viewed) || 0;
  const blind = buildFunnelBlindFlags(funnel, rates);
  const signupsTarget = northStar?.targets?.signups_per_day ?? 100;

  const awarenessBlind = blind.awareness;
  const awarenessScore = awarenessBlind ? 0 : awarenessTrafficScore(humanPageViews, windowDays);

  const previewRate = rates.preview_per_page_view ?? rates.preview_per_url_submitted;
  const previewScore = blind.preview ? 0 : previewRate == null ? -1 : previewRate;

  const signupRate = rates.signup_per_preview;
  const signupScore = blind.signup ? 0 : signupRate == null ? -1 : signupRate;

  const stages = [
    {
      id: 'awareness',
      label: 'Awareness / traffic',
      rate: awarenessScore,
      blind: awarenessBlind,
      problem: awarenessBlind
        ? `Human top-of-funnel dead: ${humanPageViews} page_views/7d, ${hf.url_submitted ?? 0} human url_submitted/7d. Manufacture traffic (outbound, SEO /find-investors, share cards) BEFORE preview/signup loops.`
        : awarenessScore < 30
          ? `Traffic far below north star (${humanPageViewsPerDay} human page_views/day vs ~${TRAFFIC_TARGET_PER_DAY}/day needed for validate milestone; target ${signupsTarget} signups/day). Outbound + SEO before downstream loops.`
          : 'Awareness adequate for current volume — optimize conversion downstream.',
    },
    {
      id: 'preview',
      label: 'Visit → preview',
      rate: previewScore,
      blind: blind.preview,
      problem: blind.preview
        ? `Preview uncomputable — ${previewViews} UI preview views/7d (need ≥5). Drive humans to /find-investors first.`
        : 'Human visitors submit URL but UI preview does not render — hero must route to /matches?url=.',
    },
    {
      id: 'signup',
      label: 'Preview → signup',
      rate: signupScore,
      blind: blind.signup,
      problem: blind.signup
        ? `Signup rate uncomputable — only ${previewViews} preview views/7d. Not a gate problem; not enough humans reached preview.`
        : 'Founders see value then leave — gate, CTA, or trust gap.',
    },
    { id: 'use', label: 'Signup → first use', rate: rates.first_match_per_signup, problem: 'Accounts created but no match engagement — activation failure.' },
    { id: 'return', label: 'Return visit', rate: rates.return_7d, problem: 'No addiction loop — one-and-done visits.' },
    { id: 'pay', label: 'Use → paid', rate: rates.checkout_per_pricing_view, problem: 'Pricing/checkout path unproven or uninstrumented.' },
  ];

  const scored = stages
    .map((st) => ({
      ...st,
      score: st.rate == null ? -1 : st.rate,
    }))
    .sort((a, b) => a.score - b.score);

  const worst = scored.find((st) => st.score >= 0) || scored[0];
  return { stage: worst, blind };
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
  const northStar = readJson(path.join(repoRoot, 'agents/north-star.json'));
  const personaConfig = loadOrchestratorPersona(repoRoot);
  const { stage: weak, blind: funnelBlindFlags } = weakestStage(funnel, northStar);

  const utcDay = new Date().getUTCDay();
  const rotationAgent =
    { 1: 'research', 2: 'growth', 3: 'product', 4: 'research', 5: 'growth', 0: 'product', 6: 'product' }[
      utcDay
    ] || 'product';
  const delegation = personaConfig?.delegation?.[rotationAgent];
  const scoutOrder =
    delegation && weak
      ? delegation.order_template
          .replace('{stage}', weak.label || weak.id)
          .replace('{weakest_stage}', weak.label || weak.id)
      : null;

  const brief = {
    date,
    persona: personaConfig
      ? {
          name: personaConfig.name,
          title: personaConfig.title,
          codename: personaConfig.codename,
          voice: personaConfig.voice?.summary,
          order: scoutOrder,
          rotating_agent: rotationAgent,
          decision_rules: personaConfig.decision_rules,
          forbidden_actions: personaConfig.forbidden_actions,
        }
      : null,
    cta_focus: personaConfig
      ? {
          doctrine: personaConfig.cta_doctrine?.principle,
          review_questions: personaConfig.review_questions,
          anti_patterns: personaConfig.cta_doctrine?.anti_patterns,
          recommended_primary_framing: personaConfig.cta_doctrine?.primary_outcome_framing,
        }
      : null,
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
      human_funnel: funnel?.human_funnel ?? {},
      conversion_rates: buildOrchestratorRates(funnel),
    },
    funnel_blind_flags: funnelBlindFlags,
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
    read_first: ['agents/ORCHESTRATOR.md', 'agents/orchestrator-persona.json', 'agents/north-star.json'],
  };

  const outDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `orchestrator-brief-${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(brief, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(brief, null, 2));
  } else {
    console.log('\n🎯 Orchestrator brief');
    console.log(`   Weakest stage: ${weak?.label} (${weak?.score ?? 'unknown'}${weak?.blind ? ', BLIND' : ''})`);
    console.log(`   Focus: ${brief.todays_focus.primary}`);
    console.log(`   Written: ${outFile}\n`);
  }
}

main();
