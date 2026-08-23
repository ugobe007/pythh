import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isFrequentLedgerFunder,
  pickCanonicalFrequentFunders,
  collectFrequentLedgerFunderIds,
  selectTopMatchesReservingForced,
  firmProfileRank,
} = require('../server/lib/frequentLedgerFunders.js');

{
  assert.equal(isFrequentLedgerFunder({ name: 'General Catalyst', firm: 'General Catalyst' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Hemant Taneja (General Catalyst)', firm: 'General Catalyst', is_individual: true }), false);
  assert.equal(isFrequentLedgerFunder({ name: 'Random Fund', firm: 'Random Fund' }), false);
  assert.equal(isFrequentLedgerFunder({ name: 'Sequoia Capital', firm: 'Sequoia Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'EQT', firm: 'EQT' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Andreessen Horowitz', firm: 'Andreessen Horowitz' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Susquehanna', firm: 'Susquehanna' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Greenoaks Capital', firm: 'Greenoaks Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'General Atlantic', firm: 'General Atlantic' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Dell Technologies Capital', firm: 'Dell Technologies Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Temasek', firm: 'Temasek Holdings' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'GIC', firm: 'GIC' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Mubadala', firm: 'Mubadala' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Goldman Sachs', firm: 'Goldman Sachs' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Kleiner Perkins', firm: 'Kleiner Perkins' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'HongShan', firm: 'HongShan' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Advent International', firm: 'Advent International' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Rainmatter Capital', firm: 'Rainmatter Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Jane Street', firm: 'Jane Street' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Georgian', firm: 'Georgian' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Greylock', firm: 'Greylock Partners' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Khosla Ventures', firm: 'Khosla Ventures' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Benchmark', firm: 'Benchmark' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Intel Capital', firm: 'Intel Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'OpenAI', firm: 'OpenAI' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Left Lane Capital', firm: 'Left Lane Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'RTP Global', firm: 'RTP Global' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Unicorn India Ventures', firm: 'Unicorn India Ventures' }), true);
}

{
  assert.equal(firmProfileRank({ name: 'General Catalyst', firm: 'General Catalyst', investor_score: 60 }), 3);
  assert.equal(firmProfileRank({ name: 'Niko Bonatsos', firm: 'General Catalyst', investor_score: 80 }), 0);
  assert.equal(firmProfileRank({ name: 'Hemant Taneja (General Catalyst)', firm: 'General Catalyst', investor_score: 90 }), -1);
}

{
  const picked = pickCanonicalFrequentFunders([
    { id: 'niko', name: 'Niko Bonatsos', firm: 'General Catalyst', investor_score: 80, is_individual: false },
    { id: 'gc', name: 'General Catalyst', firm: 'General Catalyst', investor_score: 60, is_individual: false },
    { id: 'thiel', name: 'Peter Thiel', firm: 'Founders Fund', investor_score: 74, is_individual: false },
    { id: 'ff', name: 'Founders Fund', firm: 'Founders Fund', investor_score: 52, is_individual: false },
    { id: 'iconiq-low', name: 'Iconiq Capital', firm: 'Iconiq', investor_score: 46, is_individual: false },
    { id: 'iconiq-high', name: 'ICONIQ Capital', firm: 'ICONIQ Capital', investor_score: 56, is_individual: false },
    { id: 'person', name: 'Partner', firm: 'General Catalyst', investor_score: 99, is_individual: true },
    { id: 'sequoia', name: 'Sequoia Capital', firm: 'Sequoia Capital', investor_score: 70 },
    { id: 'eqt', name: 'EQT', firm: 'EQT', investor_score: 55 },
  ]);
  assert.ok(picked.some((r) => r.id === 'gc'), 'GC firm beats Niko');
  assert.ok(!picked.some((r) => r.id === 'niko'));
  assert.ok(picked.some((r) => r.id === 'ff'), 'Founders Fund firm beats Thiel');
  assert.ok(!picked.some((r) => r.id === 'thiel'));
  assert.ok(picked.some((r) => r.id === 'iconiq-high'));
  assert.ok(picked.some((r) => r.id === 'sequoia'));
  assert.ok(picked.some((r) => r.id === 'eqt'));
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
