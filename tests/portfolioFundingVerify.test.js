const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractAmountUsd,
  extractValuationUsd,
  isRumorFundingHeadline,
  shouldReclassifyAsAcquisition,
  proposeVerifiedPostMoney,
} = require('../server/lib/portfolioFundingVerify');

test('extractValuationUsd reads explicit press valuations, not raise size', () => {
  assert.equal(
    extractValuationUsd('Addi raises $85 million at a $1.3 billion valuation'),
    1_300_000_000
  );
  assert.equal(extractValuationUsd('Company hits $3 billion valuation after Series C'), 3_000_000_000);
  assert.equal(extractValuationUsd('Startup valued at nearly $400 million'), 400_000_000);
  assert.equal(extractValuationUsd('Round closed at a $90M post-money valuation'), 90_000_000);
  assert.equal(extractValuationUsd('Heylua raises $5.8 million seed'), null);
  assert.equal(extractValuationUsd('Addi raises $85 million from Citi'), null);
});

test('isRumorFundingHeadline rejects speculative raise copy', () => {
  assert.equal(isRumorFundingHeadline('Upscale AI eyes $200M raise'), true);
  assert.equal(isRumorFundingHeadline('Firm reportedly raising Series B'), true);
  assert.equal(isRumorFundingHeadline('Startup set to raise $40 million'), true);
  assert.equal(isRumorFundingHeadline('Heylua raises $5.8 million seed'), false);
});

test('shouldReclassifyAsAcquisition separates acquire headlines from raises', () => {
  assert.equal(
    shouldReclassifyAsAcquisition({
      event_type: 'funding_round',
      headline: 'OpenAI acquires Statsig for $1.1B',
    }),
    true
  );
  assert.equal(
    shouldReclassifyAsAcquisition({
      event_type: 'funding_round',
      headline: 'Acme raises $20M Series A led by Sequoia',
    }),
    false
  );
  assert.equal(
    shouldReclassifyAsAcquisition({
      event_type: 'acquisition',
      headline: 'OpenAI acquires Statsig for $1.1B',
    }),
    false
  );
});

test('proposeVerifiedPostMoney fills verified rows only', () => {
  assert.equal(
    proposeVerifiedPostMoney({
      verified: false,
      event_type: 'funding_round',
      amount_usd: 5_800_000,
      headline: 'Heylua raises $5.8 million',
    }),
    null
  );
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 200_000_000,
      headline: 'Upscale AI eyes $200M raise',
    }),
    null
  );
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 85_000_000,
      post_money_usd: 1_300_000_000,
      headline: 'Addi raises $85 million',
    }),
    null
  );

  const headline = proposeVerifiedPostMoney({
    verified: true,
    event_type: 'funding_round',
    amount_usd: 85_000_000,
    headline: 'Addi raises $85 million at a $1.3 billion valuation',
  });
  assert.deepEqual(headline, { post_money_usd: 1_300_000_000, basis: 'headline_valuation' });

  const estimated = proposeVerifiedPostMoney({
    verified: true,
    event_type: 'funding_round',
    amount_usd: 5_800_000,
    round_type: 'seed',
    headline: 'Heylua raises $5.8 million seed',
  });
  assert.equal(estimated?.basis, 'dilution_estimate');
  assert.ok(estimated.post_money_usd > 5_800_000);
  assert.equal(extractAmountUsd('Heylua raises $5.8 million seed'), 5_800_000);
});
