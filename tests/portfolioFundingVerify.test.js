const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractAmountUsd,
  extractValuationUsd,
  isRumorFundingHeadline,
  isMismatchedFundingHeadline,
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

test('shouldReclassifyAsAcquisition only when the pick is the target', () => {
  assert.equal(
    shouldReclassifyAsAcquisition(
      { event_type: 'funding_round', headline: 'OpenAI acquires Statsig for $1.1B' },
      'Statsig'
    ),
    true
  );
  assert.equal(
    shouldReclassifyAsAcquisition(
      {
        event_type: 'funding_round',
        headline: 'LaunchDarkly to "double down" on observability with Highlight acquisition',
      },
      'LaunchDarkly'
    ),
    false
  );
  assert.equal(
    shouldReclassifyAsAcquisition(
      { event_type: 'funding_round', headline: 'Acme raises $20M Series A led by Sequoia' },
      'Acme'
    ),
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
    }, 'Heylua'),
    null
  );
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 200_000_000,
      headline: 'Upscale AI eyes $200M raise',
    }, 'Upscale AI'),
    null
  );
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 89_000_000,
      headline: "Colombia's Addi secures $89mn Citi facility, lifting total",
    }, 'Addi'),
    null
  );
  assert.equal(
    isMismatchedFundingHeadline('Qnetic raises $5M to start up U.S. manufacturing for flywheel storage', 'Flywheel'),
    true
  );
  assert.equal(isMismatchedFundingHeadline('Lua Raises $5.8 Million in Funding', 'Heylua'), false);
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 150_000,
      headline: 'Polar Power, Inc. announced that it has received $0.15 million',
    }, { name: 'Polar', website: 'https://polar.sh' }),
    null
  );
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 25_000_000,
      headline: 'Aave DAO approves $25 million funding and V4 roadmap',
    }, 'Aave'),
    null
  );
  const lua = proposeVerifiedPostMoney({
    verified: true,
    event_type: 'funding_round',
    amount_usd: 5_800_000,
    round_type: 'seed',
    headline: 'Lua Raises $5.8 Million in Funding - The SaaS News',
  }, 'Heylua');
  assert.equal(lua?.basis, 'dilution_estimate');
  assert.equal(
    extractValuationUsd('Belgian unicorn Odoo reaches €7B valuation after General Atlantic'),
    null
  );
  assert.equal(
    proposeVerifiedPostMoney({
      verified: true,
      event_type: 'funding_round',
      amount_usd: 85_000_000,
      post_money_usd: 1_300_000_000,
      headline: 'Addi raises $85 million',
    }, 'Addi'),
    null
  );

  const headline = proposeVerifiedPostMoney({
    verified: true,
    event_type: 'funding_round',
    amount_usd: 85_000_000,
    headline: 'Addi raises $85 million at a $1.3 billion valuation',
  }, 'Addi');
  assert.deepEqual(headline, { post_money_usd: 1_300_000_000, basis: 'headline_valuation' });

  const estimated = proposeVerifiedPostMoney({
    verified: true,
    event_type: 'funding_round',
    amount_usd: 5_800_000,
    round_type: 'seed',
    headline: 'Heylua raises $5.8 million seed',
  }, 'Heylua');
  assert.equal(estimated?.basis, 'dilution_estimate');
  assert.ok(estimated.post_money_usd > 5_800_000);
  assert.equal(extractAmountUsd('Heylua raises $5.8 million seed'), 5_800_000);
});
