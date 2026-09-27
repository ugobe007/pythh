import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  foldMatchModel,
  researchFitDelta,
  applyResearchRank,
  withMatchModel,
} = require('../lib/matchModelFromResearch.js');

test('researched rounds become stage, sector, and why-they-funded', () => {
  const first = foldMatchModel(null, {
    aspectCounts: { hiring: 2, revenue_growth: 1 },
    events: [{
      id: 'e1',
      amount_usd: 8_000_000,
      round_type: 'seed',
      sectors: ['Robotics', 'AI'],
    }],
  });
  assert.equal(first.added, 1);
  assert.deepEqual(first.model.priorities, ['hire', 'revenue']);
  assert.deepEqual(first.model.stages, ['seed']);
  assert.deepEqual(first.model.sectors, ['robotics']);
  assert.equal(first.model.median_amount_usd, 8_000_000);

  const second = foldMatchModel(first.model, {
    aspectCounts: { hiring: 2, revenue_growth: 1 },
    events: [
      { id: 'e1', amount_usd: 8_000_000, round_type: 'seed', sectors: ['Robotics'] },
      { id: 'e2', amount_usd: 20_000_000, round_type: 'series-a', sectors: ['Robotics'] },
    ],
  });
  assert.equal(second.added, 1);
  assert.equal(second.model.event_count, 2);
  assert.ok(second.model.stages.includes('series-a'));
});

test('the match model moves a fund that has funded this kind of round', () => {
  const hiringFund = {
    signals: {
      match_model: {
        event_count: 3,
        stages: ['seed'],
        sectors: ['Robotics'],
        priorities: ['hire'],
      },
    },
  };
  const revenueFund = {
    signals: {
      match_model: {
        event_count: 3,
        stages: ['seed'],
        sectors: ['Robotics'],
        priorities: ['revenue'],
      },
    },
  };
  const unknown = { signals: {} };
  const startup = {
    sectors: ['Robotics'],
    extracted_data: { funding_stage: 'seed', raise_priorities: ['hire'] },
  };
  assert.ok(researchFitDelta(startup, hiringFund) > researchFitDelta(startup, revenueFund));
  assert.equal(researchFitDelta(startup, unknown), 0);

  const rows = [
    { investor_id: 'a', fit_rank: 80, investor: revenueFund },
    { investor_id: 'b', fit_rank: 70, investor: hiringFund },
  ];
  assert.equal(applyResearchRank(startup, rows), true);
  assert.ok(rows.find((row) => row.investor_id === 'b').fit_rank > rows.find((row) => row.investor_id === 'a').fit_rank);
});

test('writing the model keeps the observed thesis', () => {
  const next = withMatchModel(
    { observed_thesis: { event_count: 2 }, top_themes: ['hiring'] },
    { version: 'match-model-v1', event_count: 2 },
  );
  assert.equal(next.observed_thesis.event_count, 2);
  assert.deepEqual(next.top_themes, ['hiring']);
  assert.equal(next.match_model.event_count, 2);
});
