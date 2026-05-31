'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidStartupName } = require('../lib/startupNameValidator');
const { evaluateStartupNameForPipeline } = require('../lib/startupNameGate');

const POLITICIANS = [
  'JD Vance',
  'J.D. Vance',
  'J.D Vance',
  'Senator JD Vance',
  'Vice President JD Vance',
  'Usha Vance',
];

for (const name of POLITICIANS) {
  test(`rejects politician name: ${name}`, () => {
    const v = isValidStartupName(name);
    assert.equal(v.isValid, false, `expected invalid, got ${v.reason}`);
    const gate = evaluateStartupNameForPipeline(name);
    assert.equal(gate.ok, false);
  });
}

test('still allows real company names', () => {
  assert.equal(isValidStartupName('Stripe').isValid, true);
  assert.equal(isValidStartupName('Odoo').isValid, true);
});
