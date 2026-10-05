import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyCardFacts, cardFactsFromRows, publicWebsite } from '../lib/investorCardFacts.js';
import { shapeMatchForApi } from '../lib/canonicalMatchApi.js';

test('public website keeps a firm homepage and drops social profiles', () => {
  assert.equal(publicWebsite('https://www.kleinerperkins.com/'), 'https://www.kleinerperkins.com/');
  assert.equal(publicWebsite('https://www.linkedin.com/company/kleiner-perkins'), null);
  assert.equal(publicWebsite('https://www.kleinerperkins.com/feed/'), null);
  assert.equal(publicWebsite('not a url'), null);
});

test('card facts keep partners, sectors, timing, deals, and the firm site', () => {
  const facts = cardFactsFromRows(
    {
      id: 'bucky',
      name: 'Bucky Moore',
      firm: 'Kleiner Perkins',
      url: 'https://kleinerperkins.com',
      sectors: ['AI/ML'],
      stage: ['Pre-Seed', 'Seed', 'Series A'],
      notable_investments: ['Amazon', 'Google'],
      email: 'hidden@kleinerperkins.com',
    },
    [
      {
        id: 'firm',
        name: 'Kleiner Perkins',
        firm: 'Kleiner Perkins',
        url: 'https://www.kleinerperkins.com/',
        partners: [{ name: 'Leigh Marie Braswell', title: 'Partner' }],
        notable_investments: ['Genentech'],
        sectors: ['enterprise software'],
      },
      {
        id: 'bucky',
        name: 'Bucky Moore',
        firm: 'Kleiner Perkins',
        title: null,
      },
      {
        id: 'other-firm',
        name: 'Jane Doe',
        firm: 'Elsewhere Capital',
        title: 'Partner',
      },
      {
        id: 'firm-label',
        name: 'Kleiner Perkins (KP)',
        firm: 'Kleiner Perkins',
        title: 'Partner',
      },
      {
        id: 'named',
        name: 'John Doerr (Kleiner Perkins)',
        firm: 'Kleiner Perkins',
        title: 'Partner',
      },
    ],
  );

  assert.equal(facts.website, 'https://kleinerperkins.com/');
  assert.deepEqual(facts.partners.map((partner) => partner.name), ['John Doerr', 'Leigh Marie Braswell', 'Bucky Moore']);
  assert.equal(facts.partners.some((partner) => /Kleiner Perkins/.test(partner.name)), false);
  assert.equal(facts.partners[0].title, 'Partner');
  assert.deepEqual(facts.sectors, ['AI/ML']);
  assert.deepEqual(facts.stage, ['Pre-Seed', 'Seed', 'Series A']);
  assert.deepEqual(facts.recent_deals.map((deal) => deal.company), ['Amazon', 'Google', 'Genentech']);
  assert.equal(JSON.stringify(facts).includes('hidden@'), false);
  assert.equal(facts.partners.some((partner) => partner.name === 'Jane Doe'), false);
  assert.equal(facts.partners.some((partner) => partner.name === 'Kleiner Perkins'), false);
});

test('apply fills an empty card and does not invent a site', () => {
  const next = applyCardFacts(
    { investor_id: '1', investor: { id: '1', name: 'Ada', firm: 'Ada Fund', recent_deals: [] } },
    cardFactsFromRows({
      id: '1',
      name: 'Ada',
      firm: 'Ada Fund',
      blog_url: 'https://ada.fund',
      sectors: [],
      focus_areas: { primary_sectors: ['Robotics'], preferred_stages: ['Seed'] },
      last_investment_date: '2026-03-02',
      notable_investments: [{ company: 'Smallbot', year: 2026, round: 'seed' }],
    }),
  );
  assert.equal(next.investor.website, 'https://ada.fund/');
  assert.deepEqual(next.investor.sectors, ['Robotics']);
  assert.deepEqual(next.investor.stage, ['Seed']);
  assert.equal(next.investor.last_investment_date, '2026-03-02');
  assert.equal(next.investor.recent_deals[0].company, 'Smallbot');
});

test('shaped matches expose the website and partners without email', () => {
  const out = shapeMatchForApi({
    match_score: 80,
    why_you_match: 'fit',
    investor: {
      id: '1',
      name: 'Kleiner Perkins',
      firm: 'Kleiner Perkins',
      type: 'VC',
      url: 'https://www.kleinerperkins.com/',
      partners: [{ name: 'Leigh Marie Braswell', title: 'Partner', email: 'leigh@kleinerperkins.com' }],
      email: 'secret@kleinerperkins.com',
    },
  });
  assert.equal(out.investor.website, 'https://www.kleinerperkins.com/');
  assert.deepEqual(out.investor.partners, [{ name: 'Leigh Marie Braswell', title: 'Partner' }]);
  assert.equal(out.investor.email, undefined);
  assert.doesNotMatch(JSON.stringify(out), /secret@|leigh@/);
});

test('preview attaches card facts and the investor card renders them', () => {
  const route = readFileSync(new URL('../server/routes/previewRoute.js', import.meta.url), 'utf8');
  const lead = readFileSync(new URL('../site/components/MatchInvestorLead.tsx', import.meta.url), 'utf8');
  assert.match(route, /attachInvestorCardFacts\(matches\)/);
  assert.match(lead, /Partners/);
  assert.match(lead, /Invests in/);
  assert.match(lead, /rel="noopener noreferrer"/);
  assert.match(lead, /Last investment/);
});
