import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  parseCampaignBrief,
  campaignColumns,
  campaignFitDelta,
  buildRaisePlan,
  retainCampaignExtracted,
  overlayCampaignQuery,
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
  assert.equal(columns.stage, 1);
  assert.equal(columns.extracted_data.funding_stage, 'seed');
  assert.equal(columns.extracted_data.description, 'keep');
  assert.equal(columns.extracted_data.has_revenue, false);
});

test('raise priorities change which investor ranks first', () => {
  const talent = {
    name: 'Talent Fund',
    firm: 'Talent Fund',
    sectors: ['Robotics'],
    stage: ['Seed'],
    investment_thesis: 'We back hiring and team building.',
  };
  const growth = {
    name: 'Growth Fund',
    firm: 'Growth Fund',
    sectors: ['Robotics'],
    stage: ['Seed'],
    investment_thesis: 'We back customer acquisition and growth.',
  };
  const hiring = {
    extracted_data: { funding_stage: 'seed', raise_priorities: ['hire'], has_revenue: false, has_product: true },
  };
  const customers = {
    extracted_data: { funding_stage: 'seed', raise_priorities: ['customers'], has_revenue: false, has_product: true },
  };
  assert.ok(campaignFitDelta(hiring, talent) > campaignFitDelta(hiring, growth));
  assert.ok(campaignFitDelta(customers, growth) > campaignFitDelta(customers, talent));
  const generalist = {
    name: 'General Fund',
    firm: 'General Fund',
    sectors: ['Robotics'],
    stage: ['Seed'],
    investment_thesis: 'We back the team and the product.',
  };
  assert.ok(campaignFitDelta(hiring, talent) - campaignFitDelta(hiring, generalist) >= 80);
});

test('enrichment keeps the founder answers and preview can rank from the request', () => {
  const kept = retainCampaignExtracted(
    { funding_stage: 'seed', has_revenue: false, raise_priorities: ['hire'], description: 'old' },
    { description: 'new scrape', funding_stage: 'series-b' },
  );
  assert.equal(kept.funding_stage, 'seed');
  assert.equal(kept.has_revenue, false);
  assert.deepEqual(kept.raise_priorities, ['hire']);
  assert.equal(kept.description, 'new scrape');
  const overlaid = overlayCampaignQuery(
    { extracted_data: { description: 'keep' } },
    { funding_stage: 'series-a', has_revenue: 'true', has_product: 'false', raise_priorities: 'customers,product' },
  );
  assert.equal(overlaid.extracted_data.funding_stage, 'series-a');
  assert.equal(overlaid.extracted_data.has_revenue, true);
  assert.equal(overlaid.extracted_data.description, 'keep');
  assert.deepEqual(overlaid.extracted_data.raise_priorities, ['customers', 'product']);
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
