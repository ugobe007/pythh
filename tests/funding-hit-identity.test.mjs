import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  firmLabelKey,
  predictionIdentityKeys,
  participantIdentityKeys,
  identityKeysOverlap,
} = require('../server/lib/fundingHitIdentity.js');

test('firm labels strip publisher debris before normalize', () => {
  assert.equal(firmLabelKey('Thrive Capital - marketscreener'), firmLabelKey('Thrive Capital'));
  assert.equal(firmLabelKey('Monashees to Build an AI Investment Advisor'), firmLabelKey('Monashees'));
});

test('duplicate Insight Partners profiles share a firm label key', () => {
  const organizationByInvestor = new Map([
    ['outcome-insight', 'org-insight'],
  ]);
  const investorById = new Map([
    ['pred-insight', { id: 'pred-insight', name: 'Insight Partners', firm: 'Insight Partners' }],
    ['outcome-insight', { id: 'outcome-insight', name: 'Insightpartners', firm: 'Insight Partners' }],
  ]);
  const predicted = predictionIdentityKeys(
    { investor_id: 'pred-insight' },
    { organizationByInvestor, investorById },
  );
  const actual = participantIdentityKeys(
    {
      investor_id: 'outcome-insight',
      investor_organization_id: 'org-insight',
      investor_name_raw: 'Insight Partners',
    },
    { investorById },
  );
  assert.ok(predicted.includes('investor:pred-insight'));
  assert.ok(!predicted.includes('organization:org-insight'), 'prediction-side missing membership');
  assert.ok(actual.includes('organization:org-insight'));
  assert.ok(identityKeysOverlap(actual, new Set(predicted)), 'label overlap must count as Hit@5');
});
