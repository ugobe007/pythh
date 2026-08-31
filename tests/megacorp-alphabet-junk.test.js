'use strict';

/**
 * Alphabet (Google parent) and Alphabet Ventures (→ GV) must not enter
 * the startup pipeline or matching as fundable startups.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidStartupName } = require('../lib/startupNameValidator');
const { evaluateStartupNameForPipeline } = require('../lib/startupNameGate');
const { isNonStartupEntity, classifyEntityType } = require('../lib/nameEntityOntology');
const { classifyEntityTrack } = require('../lib/startupNameLogicEngine');

const REJECT = [
  'Alphabet',
  'Alphabet Inc',
  'Alphabet Inc.',
  "Alphabet Inc.'s",
  'Alphabet Ventures',
  'Alphabet VC',
  'Alphabet Looks',
  'Alphabet Set',
  'Alphabet Buffett',
  'Dollar Debt Alphabet',
  'Google-parent Alphabet',
  'Google Ventures',
  'Andreessen',
  'a16z',
  'Sequoia',
];

const ALLOW = ['Stripe', 'Legora', 'Coderabbit', 'Hadrian', 'Anduril'];

for (const name of REJECT) {
  test(`pipeline rejects megacorp/junk: ${name}`, () => {
    const gate = evaluateStartupNameForPipeline(name);
    assert.equal(gate.ok, false, `${name} gate should fail, got ok with reason=${gate.reason}`);
  });
}

test('Alphabet exact is brand entity + invalid name', () => {
  assert.equal(classifyEntityType('Alphabet'), 'brand');
  assert.equal(isNonStartupEntity('Alphabet'), true);
  assert.equal(isValidStartupName('Alphabet').isValid, false);
  assert.equal(classifyEntityTrack('Alphabet').track, 'descriptor');
});

test('Alphabet Ventures is investor track (GV), not startup', () => {
  assert.equal(classifyEntityTrack('Alphabet Ventures').track, 'investor');
  assert.equal(evaluateStartupNameForPipeline('Alphabet Ventures').ok, false);
});

test('solo VC brands are investor track, not startups', () => {
  assert.equal(classifyEntityTrack('Andreessen').track, 'investor');
  assert.equal(classifyEntityTrack('a16z').track, 'investor');
  assert.equal(classifyEntityTrack('Sequoia').track, 'investor');
});

test('Alphabet-prefixed headline fragments are brand/non-startup', () => {
  assert.equal(isNonStartupEntity('Alphabet Looks'), true);
  assert.equal(isNonStartupEntity('Dollar Debt Alphabet'), true);
});

for (const name of ALLOW) {
  test(`still allows real startup: ${name}`, () => {
    assert.equal(evaluateStartupNameForPipeline(name).ok, true);
    assert.equal(isValidStartupName(name).isValid, true);
  });
}
