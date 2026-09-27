import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  tallyInvestmentEvidence,
  learnComponentWeights,
  MIN_OBSERVATIONS,
} = require('../lib/godWeightLearner.js');

const CURRENT = { team: 0.22, traction: 0.30, market: 0.20, product: 0.15, vision: 0.13 };

test('a thin sample does not move GOD weights', () => {
  const evidence = tallyInvestmentEvidence([
    { aspect_counts: { hiring: 2 }, priorities: ['hire'] },
  ]);
  assert.ok(evidence.observations < MIN_OBSERVATIONS);
  const learned = learnComponentWeights(CURRENT, evidence);
  assert.equal(learned.moved, false);
  assert.equal(learned.reason, 'not_enough_observations');
  assert.deepEqual(learned.weights, CURRENT);
});

test('funded-round evidence steps traction up and keeps the shares at 1', () => {
  const models = Array.from({ length: 40 }, () => ({
    aspect_counts: { revenue_growth: 3, customer_growth: 2, hiring: 1 },
  }));
  const evidence = tallyInvestmentEvidence(models);
  assert.ok(evidence.observations >= MIN_OBSERVATIONS);
  assert.ok(evidence.counts.traction > evidence.counts.team);
  const learned = learnComponentWeights(CURRENT, evidence);
  assert.equal(learned.moved, true);
  assert.ok(learned.weights.traction > CURRENT.traction);
  assert.ok(learned.weights.traction - CURRENT.traction <= 0.02 + 1e-9);
  assert.equal(learned.weights.vision, CURRENT.vision);
  const sum = Object.values(learned.weights).reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
  for (const value of Object.values(learned.weights)) assert.ok(value >= 0.08);
});
