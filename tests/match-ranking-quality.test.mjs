import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { calculateMatch, calculateSectorFit } = require('../scripts/matching/generate-matches.js');
const { normalizeStage, scoreHistoricalFit } = require('../server/lib/investorHistoricalFeatures.js');
const { stageLabel } = require('../server/lib/stageTaxonomy.js');
const { calculateMatchScore } = require('../lib/outreachMatch.js');

test('canonical sector matching rejects substring collisions', () => {
  const fit = calculateSectorFit(['AI/ML'], ['Retail']);
  assert.deepEqual(fit, { points: 0, direct_matches: [], related_matches: [] });
});

test('canonical sector matching distinguishes direct and adjacent fit', () => {
  const fit = calculateSectorFit(['Developer Tools', 'B2B SaaS'], ['AI/ML', 'SaaS']);
  assert.equal(fit.points, 10);
  assert.deepEqual(fit.direct_matches, ['SaaS']);
  assert.deepEqual(fit.related_matches, ['AI/ML']);
});

test('stage-fit flag represents stage alignment instead of total raw score', () => {
  const match = calculateMatch(
    { total_god_score: 100, stage: 2, sectors: ['SaaS'] },
    { id: 'growth-only', stage: ['Series C'], sectors: ['SaaS'], investor_score: 10 },
  );
  assert.equal(match.stage_fit, false);
  assert.equal(match.investor_fit_components.stage, 0);
  assert.equal(match.investor_fit_components.sector, 7);
});

test('numeric startup stages align with verified historical round stages', () => {
  assert.equal(normalizeStage(2), 'seed');
  const result = scoreHistoricalFit({ stage: 2, sectors: [] }, {
    deal_count: 1,
    stages: { seed: 1 },
    sectors: {},
    last_investment_at: null,
  }, new Date('2026-01-01T00:00:00Z'));
  assert.ok(result.points >= 7);
  assert.ok(result.reasons.includes('Historical stage fit'));
});

test('live and outreach matching preserve the database 1–5 stage scale', () => {
  assert.equal(stageLabel(1), 'Pre-Seed');
  assert.equal(stageLabel(2), 'Seed');
  assert.equal(stageLabel(3), 'Series A');
  const result = calculateMatchScore(
    { id: 'startup', stage: 2, sectors: ['SaaS'], total_god_score: 80 },
    { id: 'investor', stage: ['Seed'], sectors: ['SaaS'], investor_score: 60 },
    0,
    null,
  );
  assert.equal(result.fitAnalysis.stage, 20);
});
