import test from 'node:test';
import assert from 'node:assert/strict';
import validation from '../lib/historicalMatchValidation.js';

const base = {
  matchCreatedAt: '2025-01-01T00:00:00Z',
  eventDate: '2025-07-02T00:00:00Z',
  startupId: 'startup-1',
  investorId: 'investor-1',
  sourceUrl: 'https://example.com/deal',
};

test('accepts canonical, sourced evidence strictly after the prediction', () => {
  assert.deepEqual(validation.classifyHistoricalOutcome(base), {
    eligible: true,
    completeIdentity: true,
    hasProvenance: true,
    isPostPrediction: true,
    reason: 'eligible_positive',
  });
});

test('rejects leakage from events at or before prediction time', () => {
  const result = validation.classifyHistoricalOutcome({ ...base, eventDate: base.matchCreatedAt });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'event_not_after_prediction');
});

test('rejects evidence without canonical pair or source', () => {
  assert.equal(validation.classifyHistoricalOutcome({ ...base, investorId: null }).reason, 'missing_canonical_identity');
  assert.equal(validation.classifyHistoricalOutcome({ ...base, sourceUrl: null }).reason, 'missing_source_provenance');
});

test('only creates negatives after an exposure-aware observation window', () => {
  assert.equal(validation.labelExposure({ positiveEvidenceCount: 0, matchCreatedAt: '2025-01-01', observedThrough: '2025-03-01' }).label, null);
  assert.equal(validation.labelExposure({ positiveEvidenceCount: 0, matchCreatedAt: '2025-01-01', observedThrough: '2025-08-01' }).label, null);
  assert.equal(validation.labelExposure({ positiveEvidenceCount: 0, matchCreatedAt: '2025-01-01', observedThrough: '2026-01-02' }).label, 0);
  assert.equal(validation.labelExposure({ positiveEvidenceCount: 2, matchCreatedAt: '2025-01-01', observedThrough: '2025-01-02' }).label, 1);
});
