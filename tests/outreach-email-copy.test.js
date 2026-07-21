'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildColdEmail,
  buildStageRaiseLine,
  humanizeWhyYouMatchForOutreach,
  outreachInvestorGreeting,
} = require('../lib/outreachEmailCopy');

describe('buildStageRaiseLine', () => {
  it('does not leave a dangling "and" when raise is missing', () => {
    assert.equal(buildStageRaiseLine('seed', null), "We're seed-stage.");
    assert.equal(buildStageRaiseLine(1, undefined), "We're seed-stage.");
  });

  it('combines stage and raise cleanly', () => {
    assert.equal(buildStageRaiseLine('seed', 2000000), "We're seed-stage and raising $2,000,000.");
  });
});

describe('humanizeWhyYouMatchForOutreach', () => {
  it('skips internal scoring tags', () => {
    const out = humanizeWhyYouMatchForOutreach(
      'Stage fit: Angel/seed investor, Stage: 1, Investor Tier: strong, Signal: Emerging (6/10), Conviction: thesis match',
      { startupName: 'OrbitalAi', sector: 'Robotics', stage: 'seed', firm: 'Accel' },
    );
    assert.match(out, /Accel/);
    assert.match(out, /seed practice/i);
    assert.match(out, /Robotics/i);
    assert.doesNotMatch(out, /Investor Tier/i);
    assert.doesNotMatch(out, /Why we match/i);
    assert.doesNotMatch(out, /pythh/i);
  });

  it('uses conviction themes when specific', () => {
    const out = humanizeWhyYouMatchForOutreach(
      ['Conviction: industrial automation, warehouse robotics'],
      { startupName: 'OrbitalAi', sector: 'Robotics', stage: 'seed', firm: 'Accel' },
    );
    assert.match(out, /industrial automation/i);
  });
});

describe('outreachInvestorGreeting', () => {
  it('uses team greeting for firms', () => {
    assert.equal(
      outreachInvestorGreeting({ name: 'Alchemist Accelerator', firm: 'Accel' }),
      'Hi team at Accel,',
    );
  });

  it('uses first name for partners', () => {
    assert.equal(
      outreachInvestorGreeting({ name: 'Sarah Chen', firm: 'Sequoia Capital' }),
      'Hi Sarah,',
    );
  });
});

describe('buildColdEmail', () => {
  it('produces readable copy without pythh score or raw tags', () => {
    const body = buildColdEmail(
      {
        name: 'OrbitalAi',
        pitch: 'Orbital AI is the cloud control plane for deployed robots; ARIA is the on-robot edge agent.',
        website: 'https://orbital-ai.io',
        stage: 1,
        sectors: ['Robotics'],
      },
      { name: 'Alchemist Accelerator', firm: 'Accel' },
      { content: { commitments: [] } },
      {
        why_you_match: [
          'Stage fit: Angel/seed investor',
          'Stage: 1',
          'Investor Tier: strong',
          'Signal: Emerging (6/10)',
          'Conviction: thesis match',
        ],
      },
      { sector: 'Robotics', stage: 'seed' },
    );

    assert.match(body, /^Hi team at Accel,/m);
    assert.match(body, /OrbitalAi/);
    assert.doesNotMatch(body, /We're seed and/i);
    assert.doesNotMatch(body, /pythh/i);
    assert.doesNotMatch(body, /Why we match:/i);
    assert.doesNotMatch(body, /Investor Tier/i);
    assert.match(body, /20 minutes/i);
  });
});
