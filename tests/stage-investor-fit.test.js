'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getStartupStageBand,
  getInvestorStageProfile,
  calculateStageInvestorFitAdjustment,
  applyStageInvestorFitAdjustment,
  investorMatchesStageFilter,
  buildInvestorStageDbOrFilter,
} = require('../lib/stageInvestorFit');

describe('getStartupStageBand', () => {
  it('maps numeric early stages', () => {
    assert.equal(getStartupStageBand(0), 'early');
    assert.equal(getStartupStageBand(1), 'early');
  });

  it('maps series stages', () => {
    assert.equal(getStartupStageBand(2), 'mid');
    assert.equal(getStartupStageBand(4), 'late');
  });
});

describe('getInvestorStageProfile', () => {
  it('classifies angels as early', () => {
    const p = getInvestorStageProfile({
      type: 'Angel',
      stage: ['Pre-Seed', 'Seed'],
      check_size_min: 100000,
      check_size_max: 500000,
    });
    assert.equal(p.band, 'early');
    assert.equal(p.isAngel, true);
  });

  it('classifies large-check growth investors as late', () => {
    const p = getInvestorStageProfile({
      type: 'VC',
      stage: ['Series C', 'Growth'],
      check_size_min: 25000000,
      check_size_max: 100000000,
    });
    assert.equal(p.band, 'late');
  });
});

describe('calculateStageInvestorFitAdjustment', () => {
  it('boosts angels for early startups', () => {
    const fit = calculateStageInvestorFitAdjustment(
      { stage: 1 },
      { type: 'Angel', stage: ['Seed'], check_size_max: 500000 }
    );
    assert.ok(fit.delta >= 10);
  });

  it('penalizes growth investors for seed startups', () => {
    const fit = calculateStageInvestorFitAdjustment(
      { stage: 1 },
      { type: 'VC', stage: ['Series C', 'Growth'], check_size_min: 30000000 }
    );
    assert.ok(fit.delta <= -10);
  });

  it('boosts growth investors for late startups', () => {
    const fit = calculateStageInvestorFitAdjustment(
      { stage: 5 },
      { type: 'PE', stage: ['Growth'], check_size_min: 50000000 }
    );
    assert.ok(fit.delta >= 8);
  });
});

describe('applyStageInvestorFitAdjustment', () => {
  it('adjusts score and attaches fit analysis', () => {
    const out = applyStageInvestorFitAdjustment(
      { score: 60, fitAnalysis: {} },
      { stage: 0 },
      { type: 'Angel', stage: ['Pre-Seed'], check_size_max: 250000 }
    );
    assert.ok(out.score > 60);
    assert.ok(out.fitAnalysis.stage_investor_delta > 0);
  });
});

describe('investorMatchesStageFilter', () => {
  it('matches angels on angel filter', () => {
    assert.equal(
      investorMatchesStageFilter({ type: 'Angel', stage: ['Seed'] }, 'angel'),
      true
    );
  });

  it('matches seed investors on early filter', () => {
    assert.equal(
      investorMatchesStageFilter({ type: 'VC', stage: ['Pre-Seed', 'Seed'], check_size_max: 3000000 }, 'early'),
      true
    );
  });

  it('rejects growth-only investors on early filter', () => {
    assert.equal(
      investorMatchesStageFilter({ type: 'VC', stage: ['Series C', 'Growth'], check_size_min: 30000000 }, 'early'),
      false
    );
  });
});

describe('buildInvestorStageDbOrFilter', () => {
  it('returns angel prefilter', () => {
    assert.match(buildInvestorStageDbOrFilter('angel'), /angel/i);
  });
});
