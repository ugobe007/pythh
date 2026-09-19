import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyFundingEvidence } = require('../server/lib/fundingEvidenceLedger.js');
const {
  evaluateSealedTop5Pairs,
  summarizeTop5PairFunding,
} = require('../server/lib/top5PairFunding.js');

function helpers() {
  return {
    classifyFundingEvidence,
    assessFundingSource: () => ({ trusted: true }),
  };
}

function set() {
  return {
    startup_id: 's1',
    predicted_at: '2026-01-01T00:00:00.000Z',
    predictions: [
      { investor_id: 'i1', rank_position: 1 },
      { investor_id: 'i2', rank_position: 2 },
      { investor_id: 'i3', rank_position: 3 },
      { investor_id: 'i4', rank_position: 4 },
      { investor_id: 'i5', rank_position: 5 },
    ],
  };
}

function identityCtx() {
  return {
    organizationByInvestor: new Map(),
    investorById: new Map([
      ['i1', { id: 'i1', name: 'Accel', firm: 'Accel' }],
      ['i2', { id: 'i2', name: 'Benchmark', firm: 'Benchmark' }],
      ['i3', { id: 'i3', name: 'Sequoia', firm: 'Sequoia' }],
      ['i4', { id: 'i4', name: 'a16z', firm: 'Andreessen Horowitz' }],
      ['i5', { id: 'i5', name: 'Founders Fund', firm: 'Founders Fund' }],
    ]),
  };
}

test('counts a sealed top-5 pair when official evidence is after the match clock', () => {
  const outcome = evaluateSealedTop5Pairs({
    set: set(),
    officialEvidence: [{
      investor_id: 'i1',
      verified: true,
      evidence_type: 'funding',
      event_at: '2026-03-01T00:00:00.000Z',
      match_created_at: '2026-01-01T00:00:00.000Z',
      source_url: 'https://example.com/raises',
    }],
    identityCtx: identityCtx(),
    asOf: new Date('2026-09-01T00:00:00.000Z'),
    ...helpers(),
  });
  assert.equal(outcome.pair_hits, 1);
  assert.equal(outcome.official_pair_hits, 1);
  assert.equal(outcome.pairs[0].pair_hit, true);
  assert.equal(outcome.pairs[0].source_url, 'https://example.com/raises');
  assert.equal(outcome.pairs[1].pair_hit, false);
});

test('rejects official evidence that predates the match', () => {
  const outcome = evaluateSealedTop5Pairs({
    set: set(),
    officialEvidence: [{
      investor_id: 'i1',
      verified: true,
      evidence_type: 'funding',
      event_at: '2025-12-01T00:00:00.000Z',
      match_created_at: '2026-01-01T00:00:00.000Z',
    }],
    identityCtx: identityCtx(),
    asOf: new Date('2026-09-01T00:00:00.000Z'),
    ...helpers(),
  });
  assert.equal(outcome.pair_hits, 0);
  assert.equal(outcome.official_pair_hits, 0);
});

test('counts a trusted ledger participant as a pair hit', () => {
  const participantsByEvent = new Map([['e1', [{
    investor_id: 'i2',
    investor_name_raw: 'Benchmark',
    participant_role: 'lead',
    participation_relation: 'LED_ROUND',
  }]]]);
  const outcome = evaluateSealedTop5Pairs({
    set: set(),
    events: [{
      id: 'e1',
      verification_status: 'verified',
      source_title: 'Acme raises $10M in Series A',
      source_url: 'https://techcrunch.com/acme',
      occurred_at: '2026-04-01T00:00:00.000Z',
      discovered_at: '2026-04-02T00:00:00.000Z',
    }],
    participantsByEvent,
    identityCtx: identityCtx(),
    asOf: new Date('2026-09-01T00:00:00.000Z'),
    ...helpers(),
  });
  assert.equal(outcome.pair_hits, 1);
  assert.equal(outcome.official_pair_hits, 0);
  assert.equal(outcome.ledger_trusted_pair_hits, 1);
  assert.equal(outcome.startup_funded_after_match, true);
  assert.equal(outcome.pairs[1].ledger_trusted, true);
});

test('does not count a ledger hit when discovery predates the prediction', () => {
  const participantsByEvent = new Map([['e1', [{
    investor_id: 'i2',
    investor_name_raw: 'Benchmark',
    participant_role: 'lead',
    participation_relation: 'LED_ROUND',
  }]]]);
  const outcome = evaluateSealedTop5Pairs({
    set: set(),
    events: [{
      id: 'e1',
      verification_status: 'verified',
      source_title: 'Acme raises $10M in Series A',
      occurred_at: '2026-04-01T00:00:00.000Z',
      discovered_at: '2025-12-01T00:00:00.000Z',
    }],
    participantsByEvent,
    identityCtx: identityCtx(),
    asOf: new Date('2026-09-01T00:00:00.000Z'),
    ...helpers(),
  });
  assert.equal(outcome.pair_hits, 0);
});

test('summarize reports pair rate and search candidates', () => {
  const summary = summarizeTop5PairFunding([
    { startup_id: 'a', pair_count: 5, pair_hits: 1, official_pair_hits: 1, evidence_pairs: 1, startup_funded_after_match: true },
    { startup_id: 'b', pair_count: 5, pair_hits: 0, official_pair_hits: 0, evidence_pairs: 0, startup_funded_after_match: false },
  ]);
  assert.equal(summary.sealed_top5_pairs, 10);
  assert.equal(summary.trusted_pair_hits, 1);
  assert.equal(summary.pair_hit_rate_pct, 10);
  assert.equal(summary.startups_with_a_top5_funder, 1);
  assert.deepEqual(summary.search_candidate_ids, ['b']);
});

test('pair-funding report uses sealed snapshots and does not rematch', () => {
  const script = readFileSync(new URL('../scripts/report-top5-pair-funding.mjs', import.meta.url), 'utf8');
  assert.match(script, /served-first-top5/);
  assert.match(script, /evaluateSealedTop5Pairs/);
  assert.match(script, /match_validation_evidence/);
  assert.match(script, /isServeGradeStartupIdentity/);
  assert.match(script, /search_candidates/);
  assert.doesNotMatch(script, /rematch|calculateHotScore|delete from startup_investor_matches/i);
});

test('funding search can target sealed startups over REST without DATABASE_URL', () => {
  const script = readFileSync(new URL('../scripts/search-startup-funding-evidence.mjs', import.meta.url), 'utf8');
  assert.match(script, /--startup-ids=/);
  assert.match(script, /startupIds\.length/);
  assert.match(script, /funding_prediction_snapshots/);
});
