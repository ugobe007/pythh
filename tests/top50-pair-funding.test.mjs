import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  rankFirmMatches,
  placeFunderRank,
  rankBucket,
  bestStartupRank,
  summarizeTopNPlacements,
} = require('../server/lib/topNPairFunding.js');

function ctx() {
  return {
    organizationByInvestor: new Map([['i2', 'org-b']]),
    investorById: new Map([
      ['i1', { id: 'i1', name: 'Accel', firm: 'Accel' }],
      ['i2', { id: 'i2', name: 'Benchmark', firm: 'Benchmark' }],
      ['i3', { id: 'i3', name: 'Sequoia', firm: 'Sequoia' }],
      ['i4', { id: 'i4', name: 'Greylock', firm: 'Greylock' }],
      ['i5', { id: 'i5', name: 'Lightspeed', firm: 'Lightspeed' }],
      ['i6', { id: 'i6', name: 'Index', firm: 'Index Ventures' }],
      ['i51', { id: 'i51', name: 'Unknown Fund', firm: 'Unknown Fund' }],
    ]),
  };
}

function matches() {
  return [
    { id: 'm1', investor_id: 'i1', match_score: 90, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'm2', investor_id: 'i2', match_score: 80, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'm3', investor_id: 'i3', match_score: 70, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'm4', investor_id: 'i4', match_score: 60, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'm5', investor_id: 'i5', match_score: 50, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'm6', investor_id: 'i6', match_score: 40, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'm51', investor_id: 'i51', match_score: 10, created_at: '2026-01-01T00:00:00.000Z', status: 'suggested' },
    { id: 'mlate', investor_id: 'i6', match_score: 99, created_at: '2026-06-01T00:00:00.000Z', status: 'suggested' },
  ];
}

test('firm-deduped rank ignores matches written after the raise', () => {
  const ranked = rankFirmMatches(matches(), ctx(), { beforeMs: Date.parse('2026-03-01T00:00:00.000Z') });
  assert.equal(ranked[0].investor_id, 'i1');
  assert.equal(ranked.find((row) => row.investor_id === 'i6').rank, 6);
  assert.equal(ranked.find((row) => row.investor_id === 'i6').match_score, 40);
  assert.ok(!ranked.some((row) => row.match_id === 'mlate'));
});

test('places a later funder in top 5, 6-50, or never-matched', () => {
  const ranked = rankFirmMatches(matches(), ctx(), { beforeMs: Date.parse('2026-03-01T00:00:00.000Z') });
  const identity = ctx();
  const accel = placeFunderRank(['investor:i1', 'label:accel'], ranked);
  const index = placeFunderRank(['investor:i6'], ranked);
  const missing = placeFunderRank(['investor:nobody'], ranked);
  assert.equal(rankBucket(accel), 'top_5');
  assert.equal(rankBucket(index), 'ranks_6_to_n');
  assert.equal(rankBucket(missing), 'never_matched');
  assert.equal(bestStartupRank([index, accel]), 1);
  assert.equal(identity.investorById.get('i1').firm, 'Accel');
});

test('summarize reports startup Hit@5 vs Hit@50', () => {
  const summary = summarizeTopNPlacements([
    { best_rank: 2, funders: [{ rank: 2 }, { rank: 12 }] },
    { best_rank: 18, funders: [{ rank: 18 }] },
    { best_rank: 80, funders: [{ rank: 80 }] },
    { best_rank: null, funders: [{ rank: null }] },
  ], { topN: 50 });
  assert.equal(summary.startups_top_5, 1);
  assert.equal(summary.startups_ranks_6_to_n, 1);
  assert.equal(summary.startups_top_n, 2);
  assert.equal(summary.startups_outside_top_n, 1);
  assert.equal(summary.startups_never_matched, 1);
  assert.equal(summary.startup_top_n_rate_pct, 50);
  assert.equal(summary.pairs_ranks_6_to_n, 2);
});

test('top-50 report ranks pre-event matches and does not rematch', () => {
  const script = readFileSync(new URL('../scripts/report-top50-pair-funding.mjs', import.meta.url), 'utf8');
  assert.match(script, /rankFirmMatches/);
  assert.match(script, /beforeMs/);
  assert.match(script, /const TOP_N = 50/);
  assert.match(script, /match_validation_evidence/);
  assert.doesNotMatch(script, /calculateHotScore|delete from startup_investor_matches/i);
});
