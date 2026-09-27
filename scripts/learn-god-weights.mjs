#!/usr/bin/env node
/**
 * Sidebar: learn startup GOD component shares from funded rounds.
 *
 * Reads investors.signals.match_model (written by funding:match-model).
 * Dry-run by default. --apply writes the stepped weights into the live
 * scoring config, the public weight copy, and server/config/god-score-weights.json.
 *
 *   npm run learn:god-weights
 *   npm run learn:god-weights -- --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { tallyInvestmentEvidence, learnComponentWeights } = require('../lib/godWeightLearner.js');

const apply = process.argv.includes('--apply');
const pageLimit = Math.min(
  Math.max(Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 500), 1),
  5000,
);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const WEIGHTS_JSON = 'server/config/god-score-weights.json';
const SCORING = 'server/services/startupScoringService.ts';
const PUBLIC_WEIGHTS = 'site/lib/godScorePublicWeights.ts';

function currentWeights() {
  const cfg = JSON.parse(readFileSync(WEIGHTS_JSON, 'utf8'));
  return cfg.weights.componentWeights;
}

function fmt(n) {
  const rounded = Math.round(Number(n) * 10000) / 10000;
  const text = String(rounded);
  return text.includes('.') ? text : `${text}.0`;
}

async function loadModels() {
  const models = [];
  const pageSize = 200;
  let offset = 0;
  while (models.length < pageLimit) {
    const end = Math.min(offset + pageSize, offset + (pageLimit - models.length)) - 1;
    const { data, error } = await db
      .from('investors')
      .select('id, signals')
      .not('signals->match_model', 'is', null)
      .range(offset, end);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.signals?.match_model) models.push(row.signals.match_model);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return models.slice(0, pageLimit);
}

function writeLiveWeights(weights, report) {
  const cfg = JSON.parse(readFileSync(WEIGHTS_JSON, 'utf8'));
  cfg.updated_at = new Date().toISOString();
  cfg.weights.componentWeights = weights;
  cfg.proposed_signal_informed = {
    ...(cfg.proposed_signal_informed || {}),
    status: 'applied_live',
    applied_at: cfg.updated_at.slice(0, 10),
    componentWeights: weights,
    learned_from: 'funded_round_aspects',
    observations: report.observations,
  };
  cfg.changelog = `${cfg.updated_at.slice(0, 10)} — sidebar learner stepped componentWeights from funded rounds (${report.observations} observations). ${cfg.changelog || ''}`;
  writeFileSync(WEIGHTS_JSON, `${JSON.stringify(cfg, null, 2)}\n`);

  const scoring = readFileSync(SCORING, 'utf8');
  const nextScoring = scoring.replace(
    /componentWeights: \{\s*team: [\d.]+,\s*traction: [\d.]+,\s*market: [\d.]+,\s*product: [\d.]+,\s*vision: [\d.]+,\s*\}/,
    `componentWeights: {\n    team: ${fmt(weights.team)},\n    traction: ${fmt(weights.traction)},\n    market: ${fmt(weights.market)},\n    product: ${fmt(weights.product)},\n    vision: ${fmt(weights.vision)},\n  }`,
  );
  if (nextScoring === scoring) throw new Error('could not update GOD_SCORE_CONFIG.componentWeights');
  writeFileSync(SCORING, nextScoring);

  const pts = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.round(value * 100)]));
  const pub = readFileSync(PUBLIC_WEIGHTS, 'utf8');
  let nextPub = pub
    .replace(/team: [\d.]+,/, `team: ${fmt(weights.team)},`)
    .replace(/traction: [\d.]+,/, `traction: ${fmt(weights.traction)},`)
    .replace(/market: [\d.]+,/, `market: ${fmt(weights.market)},`)
    .replace(/product: [\d.]+,/, `product: ${fmt(weights.product)},`)
    .replace(/vision: [\d.]+,/, `vision: ${fmt(weights.vision)},`);
  nextPub = nextPub.replace(
    /Team \d+, traction \d+, market \d+, product \d+, vision \d+ — (?:signal-informed live|learned from funded rounds,) shares that sum to 100\./,
    `Team ${pts.team}, traction ${pts.traction}, market ${pts.market}, product ${pts.product}, vision ${pts.vision} — learned from funded rounds, shares that sum to 100.`,
  );
  nextPub = nextPub.replace(
    /live weights \d+ \/ \d+ \/ \d+ \/ \d+ \/ \d+/,
    `live weights ${pts.team} / ${pts.traction} / ${pts.market} / ${pts.product} / ${pts.vision}`,
  );
  if (nextPub === pub) throw new Error('could not update public GOD weight copy');
  writeFileSync(PUBLIC_WEIGHTS, nextPub);
}

async function main() {
  const mode = apply ? 'apply' : 'dry-run';
  console.error(`god-weight-learner  ${mode}  limit=${pageLimit}`);
  const models = await loadModels();
  const evidence = tallyInvestmentEvidence(models);
  const learned = learnComponentWeights(currentWeights(), evidence);
  const report = {
    mode,
    investors: evidence.investors,
    observations: evidence.observations,
    counts: evidence.counts,
    moved: learned.moved,
    reason: learned.reason,
    from: currentWeights(),
    to: learned.weights,
    target: learned.target || null,
  };
  mkdirSync('reports', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `reports/god-weight-learner-${stamp}.json`;
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.error(`report ${reportPath}`);
  if (apply && learned.moved) {
    writeLiveWeights(learned.weights, report);
    console.error('wrote live component weights');
  } else if (apply) {
    console.error(`no weight change (${learned.reason})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
