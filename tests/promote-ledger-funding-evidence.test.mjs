import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isCleanInvestorHit, filterCleanHits } = require('../server/lib/matchEvidenceInvestorHit.js');

test('clean investor hit accepts org entity and Partner (Firm)', () => {
  assert.equal(isCleanInvestorHit({ id: '1', name: 'Accel', firm: 'Accel' }, 'Accel'), true);
  assert.equal(
    isCleanInvestorHit({ id: '2', name: 'Pierce Daly (Accel)', firm: 'Accel' }, 'Accel'),
    true,
  );
  assert.equal(
    isCleanInvestorHit({ id: '3', name: 'Alchemist Accelerator', firm: 'Accel' }, 'Accel'),
    false,
  );
  assert.equal(
    isCleanInvestorHit({ id: '4', name: 'Mahendran Balachandran', firm: 'Accel' }, 'Accel'),
    false,
  );
});

test('filterCleanHits drops polluted firm-field collisions', () => {
  const hits = filterCleanHits([
    {
      investor: { id: '1', name: 'Accel', firm: 'Accel' },
      investorNameRaw: 'Accel',
    },
    {
      investor: { id: '2', name: 'Alchemist Accelerator', firm: 'Accel' },
      investorNameRaw: 'Accel',
    },
    {
      investor: { id: '3', name: 'Pierce Daly (Accel)', firm: 'Accel' },
      investorNameRaw: 'Accel',
    },
  ]);
  assert.deepEqual(
    hits.map((h) => h.investor.id).sort(),
    ['1', '3'],
  );
});

test('promote ledger script and agent loop are wired', () => {
  const promote = readFileSync(
    new URL('../scripts/promote-ledger-funding-evidence.mjs', import.meta.url),
    'utf8',
  );
  assert.match(promote, /filterCleanHits/);
  assert.match(promote, /review_match_validation_evidence/);
  assert.match(promote, /reject-low-pending/);

  const agent = readFileSync(new URL('../scripts/agents/match-outcome-agent.mjs', import.meta.url), 'utf8');
  assert.match(agent, /promote-ledger-funding-evidence\.mjs/);
  assert.match(agent, /reject-low-pending/);

  const search = readFileSync(
    new URL('../scripts/search-startup-funding-evidence.mjs', import.meta.url),
    'utf8',
  );
  assert.match(search, /site:businesswire\.com/);
  assert.match(search, /filterCleanHits/);

  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  assert.match(pkg, /"outcomes:promote-ledger"/);
});
