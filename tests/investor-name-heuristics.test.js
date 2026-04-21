/**
 * Investor name garbage heuristics (no network).
 * Run: node tests/investor-name-heuristics.test.js
 */

'use strict';

const assert = require('assert');
const { isGarbageInvestorName } = require('../lib/investorNameHeuristics');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

test('accepts simple person names', () => {
  assert.strictEqual(isGarbageInvestorName('Ali Yahya'), false);
  assert.strictEqual(isGarbageInvestorName('Jane Doe'), false);
  assert.strictEqual(isGarbageInvestorName('Mary Jane Watson'), false);
  assert.strictEqual(isGarbageInvestorName('DeMarco'), false);
  assert.strictEqual(isGarbageInvestorName('McDonald'), false);
});

test('accepts firm-style names', () => {
  assert.strictEqual(isGarbageInvestorName('Sequoia Capital'), false);
  assert.strictEqual(isGarbageInvestorName('Acme Ventures'), false);
});

test('rejects scraper concat and program tags (user examples)', () => {
  assert.strictEqual(
    isGarbageInvestorName('AdministratorOperationsRahul Meka (Playground)'),
    true
  );
  assert.strictEqual(isGarbageInvestorName('Assistant Guy Wuollet (A16zcrypto)'), true);
  assert.strictEqual(isGarbageInvestorName('Startup Lessons for (A16z)'), true);
  assert.strictEqual(isGarbageInvestorName('Michelle WagnerOperating (Playground)'), true);
  assert.strictEqual(isGarbageInvestorName('Investing Ali Yahya (A16zcrypto)'), true);
  assert.strictEqual(isGarbageInvestorName('Bio Kristen Rocca (Dcvc)'), true);
  assert.strictEqual(
    isGarbageInvestorName('SongData ScientistTechnicalNicole Sonnert (Playground)'),
    true
  );
  assert.strictEqual(
    isGarbageInvestorName('Life SciencesPlatformVictoria Chernow (Playground)'),
    true
  );
});

test('rejects headline / role prefixes', () => {
  assert.strictEqual(isGarbageInvestorName('Data Scientist Jane Smith'), true);
});

console.log('\ninvestor-name-heuristics: all passed\n');
