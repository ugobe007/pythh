import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  parseCampaignBrief,
  campaignColumns,
  buildRaisePlan,
} = require('../lib/campaignBrief.js');
const { buildFreeDeckFocus } = require('../lib/deckOutline.js');

test('a campaign brief keeps stage, proof, and raise priorities', () => {
  const brief = parseCampaignBrief({
    funding_stage: 'seed',
    has_revenue: false,
    has_product: true,
    raise_priorities: ['hire', 'customers', 'nope'],
  });
  assert.equal(brief.stage, 'seed');
  assert.equal(brief.hasRevenue, false);
  assert.equal(brief.hasProduct, true);
  assert.deepEqual(brief.priorities, ['hire', 'customers']);
  const columns = campaignColumns({
    funding_stage: 'seed',
    has_revenue: false,
    has_product: true,
    raise_priorities: ['hire'],
  }, { description: 'keep' });
  assert.equal(columns.stage, 2);
  assert.equal(columns.extracted_data.funding_stage, 'seed');
  assert.equal(columns.extracted_data.description, 'keep');
  assert.equal(columns.extracted_data.has_revenue, false);
});

test('the raise plan names the round and what the money is for', () => {
  const plan = buildRaisePlan({
    stage: 'pre-seed',
    hasRevenue: false,
    hasProduct: false,
    priorities: ['revenue', 'product'],
  });
  assert.equal(plan.round, 'pre-seed');
  assert.match(plan.proof, /does not have revenue/);
  assert.deepEqual(plan.proceeds, ['Reach revenue', 'Ship the next version']);
});

test('free deck lines follow the campaign answers', () => {
  const focus = buildFreeDeckFocus({
    name: 'Harbor',
    sectors: ['Robotics'],
    extracted_data: { has_revenue: false, raise_priorities: ['hire', 'customers'] },
  });
  assert.match(focus[1].detail, /no revenue yet/);
  assert.match(focus[2].detail, /hire the team/);
});
