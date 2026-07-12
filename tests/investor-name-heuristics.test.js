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
  assert.strictEqual(isGarbageInvestorName('a16z Scout Fund'), false);
  assert.strictEqual(isGarbageInvestorName('8VC Fund'), false);
});

test('rejects scraped lowercase VC suffix fragments', () => {
  assert.strictEqual(isGarbageInvestorName('million growth capital'), true);
  assert.strictEqual(isGarbageInvestorName('ed ventures'), true);
});

test('rejects publisher headline concat junk', () => {
  assert.strictEqual(isGarbageInvestorName('Journal Eka Ventures'), true);
  assert.strictEqual(isGarbageInvestorName('Ventureburn Haun Ventures'), true);
  assert.strictEqual(isGarbageInvestorName('Bloomberg Blockchain Capital'), true);
  assert.strictEqual(isGarbageInvestorName('existing investor Singular'), true);
  assert.strictEqual(isGarbageInvestorName('Times Physis Capital'), true);
  assert.strictEqual(isGarbageInvestorName('Global Mouro Capital'), true);
  assert.strictEqual(isGarbageInvestorName('Bloomberg Beta'), false);
  assert.strictEqual(isGarbageInvestorName('Global Founders Capital'), false);
  assert.strictEqual(isGarbageInvestorName('Day One Capital'), false);
  assert.strictEqual(isGarbageInvestorName('Black Diamond Ventures'), false);
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

test('rejects NFX blog scraper fragments', () => {
  assert.strictEqual(isGarbageInvestorName('investing network for (Nfx)'), true);
  assert.strictEqual(isGarbageInvestorName('invested in diverse (Nfx)'), true);
  assert.strictEqual(isGarbageInvestorName('Investors who were (Nfx)'), true);
  assert.strictEqual(isGarbageInvestorName('NFX'), false);
});

console.log('\ninvestor-name-heuristics: all passed\n');
