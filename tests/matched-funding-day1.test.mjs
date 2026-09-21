import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  officialDay1Pairs,
  summarizeOfficialPairs,
  isPostDay1LedgerEvent,
} = require('../server/lib/matchedFundingDay1.js');

test('official pairs require verified evidence after match day 1', () => {
  const matchById = new Map([
    ['m1', { id: 'm1', startup_id: 's1', investor_id: 'i1', created_at: '2026-01-01T00:00:00Z' }],
    ['m2', { id: 'm2', startup_id: 's2', investor_id: 'i2', created_at: '2026-03-01T00:00:00Z' }],
  ]);
  const pairs = officialDay1Pairs(
    [
      { id: 'e1', match_id: 'm1', startup_id: 's1', investor_id: 'i1', verified: true, event_at: '2026-02-01T00:00:00Z', evidence_type: 'funding' },
      { id: 'e2', match_id: 'm1', startup_id: 's1', investor_id: 'i1', verified: true, event_at: '2025-12-01T00:00:00Z', evidence_type: 'funding' },
      { id: 'e3', match_id: 'm2', startup_id: 's2', investor_id: 'i2', verified: false, event_at: '2026-04-01T00:00:00Z', evidence_type: 'funding' },
      { id: 'e4', match_id: 'm2', startup_id: 's2', investor_id: 'i2', verified: true, event_at: '2026-04-01T00:00:00Z', evidence_type: 'press' },
    ],
    matchById
  );
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].evidence_id, 'e1');
  assert.equal(pairs[0].days_after_match, 31);
  const summary = summarizeOfficialPairs(pairs);
  assert.equal(summary.official_pairs, 1);
  assert.equal(summary.startups_with_official_pair, 1);
});

test('ledger hunt keeps only events after the match clock', () => {
  assert.equal(
    isPostDay1LedgerEvent({ announced_at: '2026-09-20' }, '2026-09-13'),
    true
  );
  assert.equal(
    isPostDay1LedgerEvent({ announced_at: '2026-09-10' }, '2026-09-13'),
    false
  );
});
