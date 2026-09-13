import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  assignIndustry,
  websiteOwnedByName,
  eligibilityReason,
  selectPythh2Book,
  buildPythh2InsertRow,
} = require('../server/lib/pythh2Construction.js');

function cand(over = {}) {
  return {
    id: over.id || 's1',
    name: over.name || 'Spangle',
    website: over.website || 'https://spangle.io',
    status: 'approved',
    entity_gate: 'qualified',
    total_god_score: over.god ?? 92,
    sectors: over.sectors || ['Developer Tools'],
    stage: over.stage ?? 1,
    tagline: over.tagline || 'Ship faster with typed infra',
    valuation_usd: over.valuation_usd ?? null,
    total_funding_usd: over.total_funding_usd ?? null,
    ...over,
  };
}

test('websiteOwnedByName accepts company hosts and rejects publisher / VC URLs', () => {
  assert.equal(websiteOwnedByName('Spangle', 'https://spangle.io'), true);
  assert.equal(websiteOwnedByName('Carbon Health', 'carbonhealth.com'), true);
  assert.equal(websiteOwnedByName('Polymarket', 'https://marketwatch.com'), false);
  assert.equal(websiteOwnedByName('Cerebras', 'https://www.eclipse.vc/'), false);
  assert.equal(websiteOwnedByName('Altavair', 'https://www.pehub.com/kkr-expands'), false);
});

test('eligibility skips late names, funds, and already-mature marks', () => {
  assert.equal(eligibilityReason(cand({ name: 'Stripe (stripe.com)', website: 'https://stripe.com' })), 'feed_gate');
  assert.equal(eligibilityReason(cand({ name: 'Carbon Health', website: 'carbonhealth.com' })), 'late_or_quarantined');
  assert.equal(eligibilityReason(cand({ name: 'Adams Street', website: 'https://adamsstreet.com' })), 'investor_firm');
  assert.equal(eligibilityReason(cand({ name: 'Anduril', website: 'https://anduril.com' })), 'late_or_quarantined');
  assert.equal(eligibilityReason(cand({ name: 'Betterment confirms', website: 'https://betterment.com' })), 'generic_or_headline_name');
  assert.equal(eligibilityReason(cand({ name: 'AutoTest 1764636208580', website: 'https://autotest.com' })), 'test_or_id_name');
  assert.equal(eligibilityReason(cand({ name: 'Disney+', website: 'https://disney.com' })), 'late_or_quarantined');
  assert.equal(eligibilityReason(cand({ tagline: 'Julie Bort / TechCrunch:' })), 'bad_tagline');
  assert.equal(eligibilityReason(cand({ tagline: 'Venture capital firm focused on crypto' })), 'bad_tagline');
  assert.equal(eligibilityReason(cand({ tagline: 'Tekpon has acquired 100% of the TNW media brands' })), 'bad_tagline');
  assert.equal(eligibilityReason(cand({ valuation_usd: 400_000_000 })), 'mature_valuation');
  assert.equal(eligibilityReason(cand({ total_funding_usd: 120_000_000 })), 'mature_funding');
  assert.equal(eligibilityReason(cand({ stage: '5' })), 'late_stage');
  assert.equal(eligibilityReason(cand()), null);
});

test('assignIndustry buckets stored sectors', () => {
  assert.equal(assignIndustry({ sectors: ['AI/ML'] }), 'AI / Infrastructure');
  assert.equal(assignIndustry({ sectors: ['Fintech'], tagline: 'Professional AI-enabled design platform' }), 'Fintech');
  assert.equal(assignIndustry({ sectors: ['HealthTech'] }), 'Health / Bio');
  assert.equal(assignIndustry({ sectors: ['Robotics'] }), 'Robotics / Industrial');
});

test('selectPythh2Book takes top GOD first then mixes industries', () => {
  const rows = [
    cand({ id: 'ai1', name: 'AlphaAi', website: 'https://alphaai.com', god: 99, sectors: ['AI/ML'] }),
    cand({ id: 'ai2', name: 'BetaAi', website: 'https://betaai.com', god: 98, sectors: ['AI/ML'] }),
    cand({ id: 'ai3', name: 'GammaAi', website: 'https://gammaai.com', god: 97, sectors: ['AI/ML'] }),
    cand({ id: 'ai4', name: 'DeltaAi', website: 'https://deltaai.com', god: 96, sectors: ['AI/ML'] }),
    cand({ id: 'ai5', name: 'EpsilonAi', website: 'https://epsilonai.com', god: 95, sectors: ['AI/ML'] }),
    cand({ id: 'ft1', name: 'PayNest', website: 'https://paynest.com', god: 90, sectors: ['Fintech'] }),
    cand({ id: 'hl1', name: 'Clinicly', website: 'https://clinicly.com', god: 88, sectors: ['HealthTech'] }),
    cand({ id: 'cl1', name: 'GridSun', website: 'https://gridsun.com', god: 87, sectors: ['Climate'] }),
    cand({ id: 'sa1', name: 'Worklane', website: 'https://worklane.com', god: 86, sectors: ['SaaS'] }),
    cand({ id: 'cy1', name: 'Vaultkit', website: 'https://vaultkit.com', god: 86, sectors: ['Cybersecurity'] }),
    cand({ id: 'skip', name: 'OldUnicorn', website: 'https://oldunicorn.com', god: 99, valuation_usd: 2_000_000_000 }),
    cand({ id: 'taken', name: 'AlreadyIn', website: 'https://alreadyin.com', god: 99, sectors: ['SaaS'] }),
  ];

  const { picks, stats } = selectPythh2Book(rows, {
    takenIds: ['taken'],
    target: 8,
    minGod: 85,
    sectorCap: 3,
  });

  assert.equal(picks.length, 8);
  assert.deepEqual(picks.slice(0, 3).map((p) => p.name), ['AlphaAi', 'BetaAi', 'GammaAi']);
  assert.equal(picks.filter((p) => p.industry === 'AI / Infrastructure').length, 3);
  assert.ok(picks.some((p) => p.name === 'PayNest'));
  assert.ok(picks.some((p) => p.name === 'Clinicly'));
  assert.ok(!picks.some((p) => p.name === 'OldUnicorn'));
  assert.ok(!picks.some((p) => p.name === 'AlreadyIn'));
  assert.ok(stats.industries >= 4);
  assert.ok(stats.avgGod >= 90);
});

test('buildPythh2InsertRow starts at 1.0× on today and does not backdate', () => {
  const now = new Date('2026-09-13T12:00:00.000Z');
  const row = buildPythh2InsertRow(cand({ god: 91, stage: 1 }), { now });
  assert.equal(row.fund_key, 'pythh_2');
  assert.equal(row.moic, 1);
  assert.equal(row.entry_date, now.toISOString());
  assert.equal(row.entered_late, false);
  assert.equal(row.entity_quarantined, false);
  assert.ok(row.entry_valuation_usd < 200_000_000);
  assert.match(row.entry_rationale, /GOD 91/);
});

test('admin seed and portfolio copy use construction, not a GOD dump', () => {
  const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(api, /selectPythh2Book/);
  assert.match(api, /buildPythh2InsertRow/);
  const page = readFileSync(new URL('../site/pages/Portfolio.tsx', import.meta.url), 'utf8');
  assert.match(page, /Top GOD first/);
  const funds = readFileSync(new URL('../server/lib/portfolioFunds.js', import.meta.url), 'utf8');
  assert.match(funds, /industry mix/);
});
