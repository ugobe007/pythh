'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildFounderShortlistBrief } = require('../lib/founderShortlistBrief');
const { matchExpiry } = require('../lib/matchExpiry');

describe('matchExpiry', () => {
  it('expires a match 7 days after created_at and never rewrites the clock', () => {
    const expiry = matchExpiry('2026-09-22T12:00:00.000Z', new Date('2026-09-28T12:00:00.000Z'));
    assert.equal(expiry.matched_at, '2026-09-22T12:00:00.000Z');
    assert.equal(expiry.expires_at, '2026-09-29T12:00:00.000Z');
    assert.equal(expiry.stale, false);
    assert.equal(expiry.days_left, 1);
  });

  it('marks the match stale once the week has passed', () => {
    const expiry = matchExpiry('2026-09-22T12:00:00.000Z', new Date('2026-09-29T12:00:00.000Z'));
    assert.equal(expiry.stale, true);
    assert.equal(expiry.days_left, 0);
  });
});

describe('buildFounderShortlistBrief', () => {
  it('includes the top matches, deck, positioning, advisors, profile link, and expiry', () => {
    const brief = buildFounderShortlistBrief({
      startupName: 'Orbital',
      tagline: 'Robots that load trucks',
      description: 'Orbital builds warehouse robots.',
      sectors: ['Robotics'],
      stage: 'pre-seed',
      scoreComponents: { traction: 22, team: 40, market: 30, product: 50, vision: 35 },
      matches: [
        {
          match_score: 81,
          why_you_match: 'Sector fit for warehouse robotics',
          investor_class: 'vc',
          matched_at: '2026-09-22T12:00:00.000Z',
          investor: { name: 'Ada Fund', firm: 'Ada Fund' },
        },
        {
          match_score: 70,
          why_you_match: 'Angel operator who has shipped logistics',
          investor_class: 'angel',
          matched_at: '2026-09-22T12:00:00.000Z',
          investor: { name: 'Sam Angel', firm: null },
        },
      ],
      profileUrl: 'https://pythh.ai/account',
      matchesUrl: 'https://pythh.ai/matches?url=orbital.ai',
      now: new Date('2026-09-28T12:00:00.000Z'),
    });

    assert.match(brief.subject, /Orbital — 5 matches expire September 29, 2026/);
    assert.match(brief.text, /https:\/\/pythh\.ai\/account/);
    assert.match(brief.text, /Ada Fund/);
    assert.match(brief.text, /Sam Angel/);
    assert.match(brief.text, /Lead with one sentence/);
    assert.match(brief.text, /Put proof on the traction slide/);
    assert.match(brief.html, /Open my profile/);
    assert.match(brief.html, /href="https:\/\/pythh\.ai\/account"/);
    assert.equal(brief.html.includes('Higgsfield'), false);
    assert.equal(brief.html.includes('Parallax'), false);
    assert.equal(brief.html.includes('Cursor'), false);
  });

  it('says when no advisor is on the shortlist', () => {
    const brief = buildFounderShortlistBrief({
      startupName: 'Orbital',
      tagline: 'Robots that load trucks',
      sectors: ['Robotics'],
      stage: 'pre-seed',
      matches: [
        {
          match_score: 80,
          why_you_match: 'Sector fit',
          investor_class: 'vc',
          investor: { name: 'Ada', firm: 'Ada Fund' },
        },
      ],
      profileUrl: 'https://pythh.ai/account',
      now: new Date('2026-09-28T12:00:00.000Z'),
    });
    assert.match(brief.text, /will not invent an advisor/);
  });
});
