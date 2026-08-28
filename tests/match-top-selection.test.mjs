import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalFirmKey, selectTopMatchesByFirm } = require('../lib/matchTopSelection.js');

{
  assert.equal(
    canonicalFirmKey({ name: 'Initialized Capital', firm: 'Initialized Capital' }),
    'label:initialized',
  );
  assert.equal(
    canonicalFirmKey({ name: 'Partner A', firm: 'Initialized Capital' }),
    'label:initialized',
  );
  assert.equal(canonicalFirmKey({ name: 'Random Angel', firm: '' }), 'label:random angel');
}

{
  const investorById = new Map([
    ['init1', { id: 'init1', name: 'Partner One', firm: 'Initialized Capital' }],
    ['init2', { id: 'init2', name: 'Partner Two', firm: 'Initialized Capital' }],
    ['accel', { id: 'accel', name: 'Accel', firm: 'Accel' }],
    ['seq', { id: 'seq', name: 'Sequoia Capital', firm: 'Sequoia Capital' }],
    ['tech', { id: 'tech', name: 'Techstars', firm: 'Techstars' }],
    ['ntt', { id: 'ntt', name: 'NTT Group', firm: 'NTT Group' }],
    ['blue', { id: 'blue', name: 'Blue Collective', firm: 'Blue Collective' }],
  ]);

  const ranked = [
    { investor_id: 'init1', match_score: 95 },
    { investor_id: 'init2', match_score: 94 },
    { investor_id: 'accel', match_score: 90 },
    { investor_id: 'seq', match_score: 88 },
    { investor_id: 'tech', match_score: 86 },
    { investor_id: 'ntt', match_score: 84 },
    { investor_id: 'blue', match_score: 82 },
  ];

  const top5 = selectTopMatchesByFirm(ranked, investorById, 5);
  assert.equal(top5.length, 5);
  const ids = top5.map((r) => r.investor_id);
  assert.ok(ids.includes('init1') || ids.includes('init2'), 'one Initialized slot');
  assert.equal(ids.filter((id) => id.startsWith('init')).length, 1, 'only one Initialized firm');
  assert.deepEqual(new Set(ids).size, 5, 'all distinct investor ids');
}

{
  const investorById = new Map([
    ['gc', { id: 'gc', name: 'General Catalyst', firm: 'General Catalyst' }],
    ['a', { id: 'a', name: 'Alpha VC', firm: 'Alpha VC' }],
    ['b', { id: 'b', name: 'Beta Capital', firm: 'Beta Capital' }],
  ]);
  const ranked = [
    { investor_id: 'a', match_score: 80 },
    { investor_id: 'b', match_score: 70 },
    { investor_id: 'gc', match_score: 40 },
  ];
  const forced = selectTopMatchesByFirm(ranked, investorById, 2, {
    forceInvestorIds: ['gc'],
  });
  assert.deepEqual(forced.map((r) => r.investor_id), ['gc', 'a']);
}

console.log('match-top-selection.test.mjs: ok');
