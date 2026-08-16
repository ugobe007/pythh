'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeOutcomeGraphScore, normalizeServedMatches, shouldSample } = require('../server/lib/capitalGraphShadow');

test('graph score requires three verified outcomes', () => {
  const result = computeOutcomeGraphScore([
    { outcome_type: 'meeting_booked', verified: true },
    { outcome_type: 'funded', verified: true },
    { outcome_type: 'term_sheet', verified: false },
  ]);
  assert.equal(result.graphScore, null);
  assert.equal(result.evidenceCount, 2);
});

test('graph score uses verified evidence with Bayesian shrinkage', () => {
  const result = computeOutcomeGraphScore([
    { outcome_type: 'meeting_booked', verified: true },
    { outcome_type: 'term_sheet', verified: true },
    { outcome_type: 'funded', verified: true },
  ]);
  assert.equal(result.graphScore, 71.17);
  assert.equal(result.evidenceCount, 3);
});

test('normalizes only identifiable scored matches in served order', () => {
  assert.deepEqual(normalizeServedMatches([
    { investor_id: 'a', match_score: 88 },
    { investors: { id: 'b' }, match_score: 77 },
    { investor_id: null, match_score: 99 },
  ]), [
    { investorId: 'a', semanticScore: 88, rankPosition: 1 },
    { investorId: 'b', semanticScore: 77, rankPosition: 2 },
  ]);
});

test('shadow sampling is explicitly enabled and rate controlled', () => {
  const env = { CAPITAL_GRAPH_SHADOW_ENABLED: 'true', CAPITAL_GRAPH_SHADOW_SAMPLE_RATE: '1' };
  assert.equal(shouldSample('unique-startup-for-test', env, Date.now(), () => 0), true);
  assert.equal(shouldSample('disabled-startup', {}, Date.now(), () => 0), false);
});
