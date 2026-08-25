/**
 * @jest-environment node
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPortfolioPublicEligible,
  buildPortfolioNarrativeFields,
  normalizeNarrativeText,
} = require('../lib/portfolioServeGate');

describe('isPortfolioPublicEligible', () => {
  it('blocks quarantined picks', () => {
    assert.equal(
      isPortfolioPublicEligible({ entity_quarantined: true, startup_name: 'Stripe' }, { status: 'approved' }),
      false
    );
  });

  it('blocks junk and rejected startups', () => {
    assert.equal(
      isPortfolioPublicEligible({ entity_quarantined: false, startup_name: 'Firmus' }, {
        status: 'rejected',
        entity_gate: 'junk',
      }),
      false
    );
  });

  it('blocks static quarantine names', () => {
    assert.equal(
      isPortfolioPublicEligible({ entity_quarantined: false, startup_name: 'Australian AI' }, {
        status: 'approved',
        entity_gate: 'qualified',
      }),
      false
    );
  });

  it('blocks written-off picks', () => {
    assert.equal(
      isPortfolioPublicEligible({ entity_quarantined: false, status: 'written_off', startup_name: 'Stripe' }, {
        status: 'approved',
        entity_gate: 'qualified',
      }),
      false
    );
  });

  it('allows clean approved picks', () => {
    assert.equal(
      isPortfolioPublicEligible({ entity_quarantined: false, startup_name: 'Stripe' }, {
        status: 'approved',
        entity_gate: 'qualified',
      }),
      true
    );
  });
});

describe('buildPortfolioNarrativeFields', () => {
  it('strips journalist prefixes and avoids duplicate summary/value prop', () => {
    const headline =
      'Sharon Klyne / Bloomberg: Sharon Klyne / Bloomberg: Blackstone and Coatue grant a $10B loan to Australian AI infrastructure startup Firmus for data center expansion.';
    const { company_summary, value_proposition } = buildPortfolioNarrativeFields({
      description: headline,
      pitch: headline,
      tagline: 'Sharon Klyne / Bloomberg:',
    });
    assert.ok(company_summary?.includes('Firmus'));
    assert.equal(value_proposition, null);
  });

  it('normalizeNarrativeText removes journalist prefix', () => {
    const t = normalizeNarrativeText('Jane Doe / TechCrunch: OpenAI raises $500M');
    assert.equal(t, 'OpenAI raises $500M');
  });
});
