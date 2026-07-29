'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getStartupFundingStage,
  evaluateFundingLifecycleFit,
  filterAndRankByFundingLifecycle,
} = require('../lib/fundingLifecycleFit');
const { buildMixedInvestorShortlist } = require('../lib/mixedInvestorShortlist');

describe('funding lifecycle normalization', () => {
  it('prefers an explicit extracted stage over a legacy numeric stage', () => {
    assert.equal(
      getStartupFundingStage({ stage: 1, extracted_data: { funding_stage: 'Pre-Seed' } }),
      'pre-seed',
    );
  });

  it('does not treat a default numeric stage as founder-confirmed funding status', () => {
    assert.equal(getStartupFundingStage({ stage: 1 }), null);
  });
});

describe('funding lifecycle eligibility', () => {
  it('pairs pre-seed startups with pre-seed investors', () => {
    const fit = evaluateFundingLifecycleFit(
      { funding_stage: 'pre-seed' },
      { type: 'VC', stage: ['Pre-Seed'] },
    );
    assert.equal(fit.eligible, true);
    assert.equal(fit.level, 'exact');
  });

  it('does not pair a pre-seed startup with a seed-only investor', () => {
    const fit = evaluateFundingLifecycleFit(
      { funding_stage: 'pre-seed' },
      { type: 'VC', stage: ['Seed'] },
    );
    assert.equal(fit.eligible, false);
  });

  it('does not pair a seed startup with a pre-seed-only investor', () => {
    const fit = evaluateFundingLifecycleFit(
      { funding_stage: 'seed' },
      { type: 'Angel', stage: ['Pre-Seed'] },
    );
    assert.equal(fit.eligible, false);
  });

  it('keeps stage-unspecified angels as inferred early-stage fallbacks', () => {
    const fit = evaluateFundingLifecycleFit(
      { funding_stage: 'seed' },
      { type: 'Angel', stage: [], check_size_max: 500000 },
    );
    assert.equal(fit.eligible, true);
    assert.equal(fit.level, 'inferred');
  });

  it('ranks exact lifecycle matches before inferred fallbacks', () => {
    const rows = [
      { investor: { id: 'fallback', type: 'Angel', stage: [] } },
      { investor: { id: 'exact', type: 'VC', stage: ['Seed'] } },
      { investor: { id: 'wrong', type: 'VC', stage: ['Series A'] } },
    ];
    const ranked = filterAndRankByFundingLifecycle(rows, { funding_stage: 'seed' });
    assert.deepEqual(ranked.map((row) => row.investor.id), ['exact', 'fallback']);
  });

  it('preserves lifecycle priority when building the founder shortlist', () => {
    const rows = filterAndRankByFundingLifecycle([
      { match_score: 95, investor: { id: 'fallback', name: 'Fallback Angel', type: 'Angel', stage: [] } },
      { match_score: 75, investor: { id: 'exact', name: 'Seed Fund', type: 'VC', stage: ['Seed'] } },
    ], { funding_stage: 'seed' });
    const shortlist = buildMixedInvestorShortlist(rows, { mix: 'all', total: 1 });
    assert.equal(shortlist[0].investor.id, 'exact');
  });
});
