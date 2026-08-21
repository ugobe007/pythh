import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isFrequentLedgerFunder,
  pickCanonicalFrequentFunders,
  collectFrequentLedgerFunderIds,
  selectTopMatchesReservingForced,
} = require('../server/lib/frequentLedgerFunders.js');

{
  assert.equal(isFrequentLedgerFunder({ name: 'General Catalyst', firm: 'General Catalyst' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Hemant Taneja (General Catalyst)', firm: 'General Catalyst', is_individual: true }), false);
  assert.equal(isFrequentLedgerFunder({ name: 'Random Fund', firm: 'Random Fund' }), false);
}

{
  const picked = pickCanonicalFrequentFunders([
    { id: 'iconiq-low', name: 'Iconiq Capital', firm: 'Iconiq', investor_score: 46, is_individual: false },
    { id: 'iconiq-high', name: 'ICONIQ Capital', firm: 'ICONIQ Capital', investor_score: 56, is_individual: false },
    { id: 'gc', name: 'General Catalyst', firm: 'General Catalyst', investor_score: 60 },
    { id: 'person', name: 'Partner', firm: 'General Catalyst', investor_score: 99, is_individual: true },
  ]);
  assert.equal(picked.length, 2);
  assert.ok(picked.some((r) => r.id === 'iconiq-high'));
  assert.ok(picked.some((r) => r.id === 'gc'));
  assert.ok(!picked.some((r) => r.id === 'person'));
}

{
  const ids = collectFrequentLedgerFunderIds([
    { id: 'ff', name: 'Founders Fund', firm: 'Founders Fund', investor_score: 52 },
    { id: 'noise', name: 'Other', firm: 'Other', investor_score: 90 },
  ]);
  assert.deepEqual([...ids], ['ff']);
}

{
  const ranked = [
    { investor_id: 'a', match_score: 90 },
    { investor_id: 'b', match_score: 80 },
    { investor_id: 'gc', match_score: 35 },
    { investor_id: 'c', match_score: 70 },
  ];
  const selected = selectTopMatchesReservingForced(ranked, ['gc'], 3);
  assert.deepEqual(selected.map((r) => r.investor_id), ['gc', 'a', 'b']);
}

console.log('frequent-ledger-funders.test.mjs: ok');
