/**
 * @jest-environment node
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isRankingsEligibleStartup,
  filterRankingsStartups,
} = require('../lib/rankingsEligibility');

describe('isRankingsEligibleStartup', () => {
  it('blocks junk entity_gate', () => {
    assert.equal(isRankingsEligibleStartup({ name: 'Stripe', entity_gate: 'junk' }).ok, false);
  });

  it('blocks quarantine names', () => {
    assert.equal(isRankingsEligibleStartup({ name: 'Australian AI', entity_gate: 'qualified' }).ok, false);
  });

  it('blocks publisher websites', () => {
    assert.equal(
      isRankingsEligibleStartup({
        name: 'Redo',
        entity_gate: 'qualified',
        website: 'https://cervinventures.com/',
      }).ok,
      false
    );
  });

  it('allows clean startups', () => {
    assert.equal(
      isRankingsEligibleStartup({
        name: 'Stripe',
        entity_gate: 'qualified',
        website: 'https://stripe.com',
      }).ok,
      true
    );
  });
});

describe('filterRankingsStartups', () => {
  it('keeps only eligible rows', () => {
    const rows = [
      { name: 'Nango', entity_gate: 'qualified', website: 'https://nango.com' },
      { name: 'Australian AI', entity_gate: 'junk' },
    ];
    const out = filterRankingsStartups(rows);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'Nango');
  });
});
