import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  PYTHH_1,
  PYTHH_2,
  resolveFundKey,
  filterByFund,
  getFund,
} = require('../server/lib/portfolioFunds.js');
const { isFundLocked, lockNote, assertFundOpen } = require('../server/lib/fundLock.js');

test('resolveFundKey maps Pythh_1 and Pythh_2 aliases', () => {
  assert.equal(resolveFundKey(''), PYTHH_1);
  assert.equal(resolveFundKey('pythh_1'), PYTHH_1);
  assert.equal(resolveFundKey('Pythh-1'), PYTHH_1);
  assert.equal(resolveFundKey('2'), PYTHH_2);
  assert.equal(resolveFundKey('pythh2'), PYTHH_2);
  assert.equal(getFund('pythh_2').name, 'Pythh_2');
});

test('Pythh_1 stays locked; Pythh_2 is open for new picks', () => {
  assert.equal(isFundLocked(), true);
  assert.equal(isFundLocked(PYTHH_1), true);
  assert.equal(isFundLocked(PYTHH_2), false);
  assert.match(lockNote(PYTHH_1), /LOCKED/);
  assert.match(lockNote(PYTHH_2), /OPEN/);
  assert.throws(() => assertFundOpen('add', PYTHH_1), /Pythh_2/);
  assert.doesNotThrow(() => assertFundOpen('add', PYTHH_2));
});

test('filterByFund keeps existing rows on Pythh_1 when fund_key is missing', () => {
  const rows = [
    { id: 'a', fund_key: 'pythh_1' },
    { id: 'b' },
    { id: 'c', fund_key: 'pythh_2' },
  ];
  assert.deepEqual(filterByFund(rows, PYTHH_1).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(filterByFund(rows, PYTHH_2).map((r) => r.id), ['c']);
});

test('portfolio page exposes both vintages', () => {
  const page = readFileSync(new URL('../site/pages/Portfolio.tsx', import.meta.url), 'utf8');
  assert.match(page, /Pythh_1/);
  assert.match(page, /Pythh_2/);
  assert.match(page, /fund=\$\{fund\}/);
  assert.match(page, /if \(fund === "pythh_1"\)/);
  const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(api, /\/api\/portfolio\/funds/);
  assert.match(api, /selectPythh2Book/);
});
