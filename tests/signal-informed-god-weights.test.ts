/**
 * Live signal-informed GOD componentWeights must rebalance core buckets.
 * Run: npx tsx tests/signal-informed-god-weights.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculateHotScore } from '../server/services/startupScoringService';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(
  readFileSync(path.join(here, '../server/config/god-score-weights.json'), 'utf8')
);
const w = cfg.weights.componentWeights;
assert.equal(Number((w.team + w.traction + w.market + w.product + w.vision).toFixed(6)), 1);
assert.equal(w.traction, 0.3);
assert.equal(w.team, 0.22);
assert.equal(w.vision, 0.13);
assert.equal(cfg.proposed_signal_informed.status, 'applied_live');

const tractionHeavy = calculateHotScore({
  name: 'TractionCo',
  website: 'https://traction.example',
  founders_count: 1,
  technical_cofounders: 0,
  team: [{ name: 'A', role: 'CEO' }],
  revenue: 2000000,
  mrr: 150000,
  active_users: 80000,
  growth_rate: 25,
  customers: 500,
  has_revenue: true,
  has_customers: true,
  launched: true,
  industries: ['SaaS'],
} as any);

const teamHeavyThinTraction = calculateHotScore({
  name: 'PedigreeCo',
  website: 'https://pedigree.example',
  founders_count: 3,
  technical_cofounders: 2,
  team: [
    { name: 'A', role: 'CEO', background: 'Ex-Google' },
    { name: 'B', role: 'CTO', background: 'Ex-Meta' },
    { name: 'C', role: 'COO', background: 'Ex-Stripe' },
  ],
  team_companies: ['Google', 'Meta', 'Stripe'],
  founder_courage: 'exceptional',
  vision_statement: 'Contrarian long-horizon thesis with deep insight into category structure',
  pitch: 'A'.repeat(400),
  market_size: 'A'.repeat(80),
  launched: false,
  industries: ['AI/ML'],
} as any);

assert.ok(
  tractionHeavy.total > teamHeavyThinTraction.total,
  `expected traction-heavy (${tractionHeavy.total}) > team/vision-heavy thin traction (${teamHeavyThinTraction.total})`
);

console.log('signal-informed-god-weights: ok');
