'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatAmount,
  formatDateLabel,
  isEarlyStageRound,
  pickInvestor,
  pickLine,
  buildFreshRoundsEdition,
  clearFreshRoundsEditionCache,
} = require('../server/lib/buildFreshRoundsEdition');

test('formatAmount uses M/K shorthand', () => {
  assert.equal(formatAmount(11_700_000), '$11.7M');
  assert.equal(formatAmount(3_000_000), '$3M');
  assert.equal(formatAmount(440_000), '$440K');
});

test('formatDateLabel is weekday // MON D, YYYY', () => {
  const label = formatDateLabel(new Date('2026-10-14T12:00:00Z'));
  assert.match(label, /^WEDNESDAY \/\/ OCT 14, 2026$/);
});

test('isEarlyStageRound keeps pre-seed/seed and drops Series B+', () => {
  assert.equal(isEarlyStageRound({ round_type: 'pre-seed', headline: 'StarSling raises $3M pre-seed' }), true);
  assert.equal(isEarlyStageRound({ round_type: 'seed', amount_usd: 4_400_000, headline: 'Claim Health raises $4.4M' }), true);
  assert.equal(isEarlyStageRound({ round_type: 'Series C', amount_usd: 400_000_000, headline: 'Chai Discovery nabs $400M Series C' }), false);
  assert.equal(isEarlyStageRound({ round_type: 'Series A', amount_usd: 20_000_000, headline: 'Foo raises Series A' }), false);
});

test('pickInvestor falls back to Undisclosed or led-by parse', () => {
  assert.equal(pickInvestor({ lead_investor: null, headline: 'Foo raises $3M' }), 'Undisclosed');
  assert.equal(
    pickInvestor({ lead_investor: null, headline: 'Foo raises $3M led by Asylum Ventures' }),
    'Asylum Ventures',
  );
});

test('pickLine prefers clean sector over polluted tagline', () => {
  const line = pickLine(
    { name: 'Claim Health', tagline: 'Claim HealthNew York, NY, USAAI Revenue', sectors: ['Healthcare'] },
    { headline: 'Claim Health raises $4.4M to help home care providers get paid' },
  );
  assert.equal(line, 'Healthcare');
});

test('buildFreshRoundsEdition returns fallback without supabase', async () => {
  clearFreshRoundsEditionCache();
  const edition = await buildFreshRoundsEdition(null, { force: true });
  assert.equal(edition.source, 'fallback');
  assert.ok(edition.rows.length >= 1);
});
