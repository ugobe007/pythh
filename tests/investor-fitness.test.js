'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateInvestorFitness } = require('../lib/investorFitness');

describe('calculateInvestorFitness', () => {
  it('rewards exact lifecycle fit and verified reachability', () => {
    const result = calculateInvestorFitness({
      match_score: 88,
      funding_lifecycle_fit: { level: 'exact' },
      investor: {
        name: 'Alex Investor',
        firm: 'Seed Fund',
        sectors: ['Robotics'],
        stage: ['Seed'],
        check_size_min: 250000,
        check_size_max: 1000000,
        email: 'alex@example.com',
        email_status: 'verified',
        investment_thesis: 'Industrial automation',
      },
    });
    assert.ok(result.score >= 88);
    assert.equal(result.confidence, 'building');
    assert.equal(result.components.lifecycle, 100);
    assert.equal(result.components.reachability, 100);
  });

  it('does not treat missing behavioral history as negative behavior', () => {
    const result = calculateInvestorFitness({
      match_score: 80,
      funding_lifecycle_fit: { level: 'compatible' },
      investor: { name: 'Angel', linkedin_url: 'https://linkedin.com/in/angel' },
    });
    assert.equal(result.components.behavior, null);
    assert.equal(result.behavior_sample_size, 0);
    assert.match(result.factors.join(' '), /still building/i);
  });

  it('raises confidence when verified outcomes accumulate', () => {
    const result = calculateInvestorFitness({
      match_score: 82,
      funding_lifecycle_fit: { level: 'exact' },
      investor: { name: 'Angel', email: 'angel@example.com' },
      investor_behavior: {
        sample_size: 12,
        response_rate: 90,
        follow_through_rate: 85,
        close_rate: 70,
        founder_experience_score: 92,
      },
    });
    assert.equal(result.confidence, 'high');
    assert.ok(result.components.behavior > 80);
  });
});
