import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isFrequentLedgerFunder,
  pickCanonicalFrequentFunders,
  pickFrequentFundersForStartup,
  collectFrequentLedgerFunderIds,
  applyPersistenceFloorWithForcedLedger,
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
  assert.equal(isFrequentLedgerFunder({ name: 'Craft Ventures', firm: 'Craft Ventures' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'First Round Capital', firm: 'First Round Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'New Enterprise Associates', firm: 'NEA' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Susquehanna Asia Venture Capital', firm: 'Susquehanna Asia Venture Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Spark Capital', firm: 'Spark Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'QIA', firm: 'Qatar Investment Authority' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Paradigm', firm: 'Paradigm' }), true);
  assert.equal(isFrequentLedgerFunder('Craft Ventures'), true);
  assert.equal(isFrequentLedgerFunder({ name: 'MaC Venture Capital', firm: 'MaC' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Kima Ventures', firm: 'Kima' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Radical Ventures', firm: 'Radical' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'IvyCap Ventures', firm: 'IvyCap Ventures' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Tether', firm: 'Tether' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Alkeon Capital', firm: 'Alkeon Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Lux Capital', firm: 'Lux Capital' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Atomico', firm: 'Atomico' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Scale Venture Partners', firm: 'Scale Venture Partners' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Upfront Ventures', firm: 'Upfront Ventures' }), true);
  assert.equal(isFrequentLedgerFunder({ name: 'Blume Founders Fund', firm: 'Blume Founders Fund' }), true);
}

{
  assert.equal(firmProfileRank({ name: 'General Catalyst', firm: 'General Catalyst', investor_score: 60 }), 4);
  assert.equal(firmProfileRank({ name: 'Initialized Capital', firm: 'Initialized Capital', investor_score: 60 }), 4);
  assert.equal(firmProfileRank({ name: 'Niko Bonatsos', firm: 'General Catalyst', investor_score: 80 }), 0);
  assert.equal(firmProfileRank({ name: 'Hemant Taneja (General Catalyst)', firm: 'General Catalyst', investor_score: 90 }), -1);
}

{
  const all = [
    { id: 'init', name: 'Initialized Capital', firm: 'Initialized Capital', sectors: ['SaaS'], investor_score: 70 },
    { id: 'seq', name: 'Sequoia Capital', firm: 'Sequoia Capital', sectors: ['Healthcare'], investor_score: 90 },
  ];
  const emptySectors = pickFrequentFundersForStartup(all, { expandedSectors: [] });
  assert.equal(emptySectors.length, 0);
  const priorOnly = pickFrequentFundersForStartup(all, { priorNameLabels: ['Sequoia Capital'] });
  assert.deepEqual(priorOnly.map((r) => r.id), ['seq']);
}

{
  // Allowlisted firm with empty sectors still force-includes when startup has sectors.
  const all = [
    { id: 'tcv', name: 'TCV', firm: 'TCV', sectors: [], investor_score: 70, is_individual: false },
    { id: 'other', name: 'Random Fund', firm: 'Random Fund', sectors: [], investor_score: 90, is_individual: false },
  ];
  const picked = pickFrequentFundersForStartup(all, { expandedSectors: ['SaaS', 'AI/ML'] });
  assert.deepEqual(picked.map((r) => r.id), ['tcv']);
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

{
  const investors = [
    { id: 'lux', name: 'Lux Capital', firm: 'Lux Capital', investor_score: 70 },
    { id: 'noise', name: 'Other', firm: 'Other', investor_score: 90 },
  ];
  const allScored = [
    { investor_id: 'lux', match_score: 22 },
    { investor_id: 'noise', match_score: 88 },
  ];
  const kept = applyPersistenceFloorWithForcedLedger(allScored, investors, 30);
  assert.deepEqual(kept.map((r) => r.investor_id).sort(), ['lux', 'noise']);
  const keptOnlyLux = applyPersistenceFloorWithForcedLedger(
    [{ investor_id: 'lux', match_score: 22 }],
    investors,
    30,
  );
  assert.deepEqual(keptOnlyLux.map((r) => r.investor_id), ['lux']);
}

console.log('frequent-ledger-funders.test.mjs: ok');
