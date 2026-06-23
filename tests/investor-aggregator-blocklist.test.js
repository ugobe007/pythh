/**
 * investorAggregatorBlocklist — keep in sync with lib/investorAggregatorBlocklist.js
 * Run: node tests/investor-aggregator-blocklist.test.js
 */

'use strict';

const assert = require('assert');
const { isNonInvestorAggregator } = require('../lib/investorAggregatorBlocklist');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

test('blocks NFX blog scraper junk', () => {
  const junk = { name: 'investing network for (Nfx)', firm: 'investing network for (Nfx)' };
  assert.strictEqual(isNonInvestorAggregator(junk), true);
});

test('allows real NFX firm', () => {
  assert.strictEqual(isNonInvestorAggregator({ name: 'NFX', firm: 'NFX' }), false);
});

test('allows person at firm', () => {
  assert.strictEqual(
    isNonInvestorAggregator({ name: 'Sarah Guo', firm: 'Conviction Partners' }),
    false
  );
});

test('allows real solo-brand firms with score', () => {
  assert.strictEqual(
    isNonInvestorAggregator({
      name: 'OpenView',
      firm: 'OpenView',
      sectors: ['AI/ML', 'SaaS'],
      investor_score: 31,
    }),
    false
  );
});

console.log('\ninvestor-aggregator-blocklist: all passed\n');
