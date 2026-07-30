'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildColdEmail,
  buildStageRaiseLine,
  humanizeWhyYouMatchForOutreach,
  outreachInvestorGreeting,
  buildInvestorFitLine,
  buildRoundFitNote,
  buildOutreachSubject,
} = require('../lib/outreachEmailCopy');

describe('buildStageRaiseLine', () => {
  it('does not leave a dangling "and" when raise is missing', () => {
    assert.equal(buildStageRaiseLine('seed', null), "We're raising a seed round.");
    assert.equal(buildStageRaiseLine(1, undefined), "We're raising a pre-seed round.");
  });

  it('combines stage and raise cleanly', () => {
    assert.equal(buildStageRaiseLine('seed', 2000000), "We're raising $2,000,000 in a seed round.");
  });
});

describe('humanizeWhyYouMatchForOutreach', () => {
  it('skips internal scoring tags', () => {
    const out = humanizeWhyYouMatchForOutreach(
      'Stage fit: Angel/seed investor, Stage: 1, Investor Tier: strong, Signal: Emerging (6/10), Conviction: thesis match',
      { startupName: 'OrbitalAi', sector: 'Robotics', stage: 'seed', firm: 'Accel' },
    );
    assert.match(out, /Accel/);
    assert.match(out, /seed/i);
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
  it('uses deck intelligence instead of reducing a company to generic website copy', () => {
    const body = buildColdEmail(
      {
        name: 'Orbital AI',
        description: 'Orbital AI is the cloud control plane for deployed robots.',
        website: 'https://orbital-ai.io',
        stage: 2,
        sectors: ['Robotics', 'AI/ML'],
        extracted_data: {
          value_proposition: 'Orbital AI is the visual memory layer for robotics: a full-stack data platform that uses cameras to observe, control, manage, and optimize robot performance.',
          founders: [{ name: 'Bob Christopher' }],
        },
        deck_filename: 'orbital-ai-deck.pdf',
      },
      {
        name: 'Adam Draper',
        firm: 'Boost VC',
        investment_thesis: 'We back frontier physical AI, robotics, and infrastructure companies.',
      },
      { content: { offer: { raise_amount: 5000000 }, commitments: [] } },
      { why_you_match: ['Sector: Robotics', 'Stage: seed'] },
      { sector: 'Robotics', stage: 'seed' },
    );

    assert.match(body, /visual memory layer for robotics/i);
    assert.match(body, /cameras to observe, control, manage, and optimize robot performance/i);
    assert.match(body, /physical AI.*Boost VC's stated investment thesis/i);
    assert.doesNotMatch(body, /cloud control plane/i);
  });

  it('produces readable copy without pythh score or raw tags', () => {
    const body = buildColdEmail(
      {
        name: 'OrbitalAi',
        pitch: 'from first deploy to production scale.',
        description: 'Orbital AI is the cloud control plane for deployed robots; ARIA is the on-robot edge agent.',
        website: 'https://orbital-ai.io',
        stage: 1,
        sectors: ['Robotics'],
        extracted_data: { founders: [{ name: 'Bob Christopher' }] },
        deck_filename: 'orbital-ai-deck.pdf',
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
      { sector: 'Robotics', stage: 'pre-seed' },
    );

    assert.match(body, /^Hi team at Accel,/m);
    assert.match(body, /OrbitalAi/);
    assert.doesNotMatch(body, /We're seed and/i);
    assert.doesNotMatch(body, /pythh/i);
    assert.doesNotMatch(body, /Why we match:/i);
    assert.doesNotMatch(body, /Investor Tier/i);
    assert.match(body, /20-minute/i);
    assert.match(body, /Bob Christopher/);
    assert.match(body, /send the deck/i);
    assert.doesNotMatch(body, /quick walkthrough/i);
    assert.doesNotMatch(body, /^from first deploy/im);
    assert.doesNotMatch(body, /rollout plan/i);
    assert.match(body, /raising a pre-seed round/i);
  });
});

describe('buildOutreachSubject', () => {
  it('uses the founder-defined category when deck intelligence identifies visual memory', () => {
    assert.equal(
      buildOutreachSubject('Orbital AI', 'Robotics', 'seed', {
        extracted_data: {
          value_proposition: 'The visual memory layer for robotics and intelligent machines.',
        },
      }),
      'Orbital AI — visual memory for robotics',
    );
  });
});

describe('investor fit details', () => {
  it('explains thesis overlap beyond a sector label', () => {
    const line = buildInvestorFitLine(
      {
        name: 'Orbital AI',
        sectors: ['Robotics'],
        extracted_data: {
          value_proposition: 'The Reality Engine is a visual memory and intelligence platform for physical AI deployments.',
        },
      },
      {
        firm: 'Boost VC',
        sectors: ['Robotics'],
        investment_thesis: 'Backing sci-fi-scale frontier technologies.',
      },
      { why_you_match: ['Sector: Robotics'] },
    );
    assert.match(line, /sci-fi-scale frontier technologies/i);
    assert.match(line, /Reality Engine/i);
    assert.match(line, /robots, cameras, sensors, and machines/i);
    assert.doesNotMatch(line, /invests in Robotics at/i);
  });

  it('flags a round that exceeds the recorded maximum check', () => {
    assert.match(
      buildRoundFitNote(
        { name: 'Orbital AI', raise_amount: 5000000 },
        { firm: 'Boost VC', check_size_max: 1000000 },
      ),
      /participant rather than sole lead/i,
    );
  });
});
