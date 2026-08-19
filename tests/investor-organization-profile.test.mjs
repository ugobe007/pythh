import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chooseRepresentative, mergeReviewedOrganizationProfiles } = require('../server/lib/investorOrganizationProfile.js');
const { profileExistedAtCutoff, classifyHistoricalCandidate } = require('../server/lib/historicalCandidateUniverse.js');

test('organization profile merging uses only reviewed memberships', () => {
  const profiles = [
    { id: 'firm', name: 'Acme Ventures', firm: 'Acme Ventures', sectors: ['FinTech'], membership_reviewed: true },
    { id: 'partner', name: 'Jane Doe', firm: 'Acme Ventures', stage: ['Seed'], membership_reviewed: true },
    { id: 'noise', name: 'Directory', firm: 'Acme Ventures', sectors: ['Quantum'], membership_reviewed: false },
  ];
  const result = mergeReviewedOrganizationProfiles(profiles);
  assert.equal(result.representative.id, 'firm');
  assert.deepEqual(result.merged.sectors, ['FinTech']);
  assert.deepEqual(result.merged.stage, ['Seed']);
  assert.deepEqual(result.fields_gained, ['stage']);
});

test('organization profile merging preserves provenance and rejects inferred-news theses', () => {
  const profiles = [
    { id: 'a', name: 'Acme', firm: 'Acme', check_size_min: 500000, investment_thesis: '[Inferred from news] AI investor', membership_reviewed: true },
    { id: 'b', name: 'Partner', firm: 'Acme', check_size_max: 5000000, investment_thesis: 'We invest in infrastructure software at seed.', membership_reviewed: true },
  ];
  const result = mergeReviewedOrganizationProfiles(profiles);
  assert.equal(result.merged.check_size_min, 500000);
  assert.equal(result.merged.check_size_max, 5000000);
  assert.equal(result.merged.investment_thesis, profiles[1].investment_thesis);
  assert.deepEqual(result.provenance.investment_thesis, ['b']);
});

test('representative selection favors an organization row over a person row', () => {
  const representative = chooseRepresentative([
    { id: 'person', name: 'Jane Doe', firm: 'Acme', sectors: ['AI'], stage: ['Seed'] },
    { id: 'firm', name: 'Acme', firm: 'Acme', sectors: ['AI'] },
  ]);
  assert.equal(representative.id, 'firm');
});

test('attribute merging does not erase meaningful stage words', () => {
  const result = mergeReviewedOrganizationProfiles([
    { id: 'firm', name: 'Acme', firm: 'Acme', stage: ['Venture', 'Series A'], membership_reviewed: true },
  ]);
  assert.deepEqual(result.merged.stage, ['Venture', 'Series A']);
});

test('historical candidate universe excludes profiles created after an event', () => {
  const investors = new Map([
    ['legacy', { id: 'legacy', created_at: '2024-01-01T00:00:00Z' }],
    ['repair', { id: 'repair', created_at: '2026-08-18T00:00:00Z' }],
  ]);
  assert.equal(profileExistedAtCutoff(investors.get('legacy'), '2025-01-01T00:00:00Z'), true);
  assert.equal(profileExistedAtCutoff(investors.get('repair'), '2025-01-01T00:00:00Z'), false);
  assert.deepEqual(classifyHistoricalCandidate(['legacy', 'repair'], investors, '2025-01-01T00:00:00Z'), {
    current: ['legacy', 'repair'], historical: ['legacy'], repaired_after_cutoff: ['repair'],
  });
});
