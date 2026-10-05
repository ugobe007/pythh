import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  dealsFromLedger,
  dealsFromEvidenceArticles,
  dealsFromFirmSite,
  mergeDeals,
  profilePatch,
} = require('../lib/investorDealBackfill.js');

const bullpen = '66d6a3c5-dd4e-4486-9b2d-6ae3eb5be761';

test('ledger deals keep a verified round and drop untrusted or junk startups', () => {
  const eventsById = new Map([
    ['event-1', {
      id: 'event-1',
      startup_id: 'bethog',
      amount_usd: 10_000_000,
      announced_at: '2026-04-22T12:15:00+00:00',
      round_type: 'Series A',
      verification_status: 'verified',
    }],
    ['event-2', {
      id: 'event-2',
      startup_id: 'rumor',
      amount_usd: 5_000_000,
      announced_at: '2026-01-01T00:00:00Z',
      round_type: 'Seed',
      verification_status: 'observed',
    }],
    ['event-3', {
      id: 'event-3',
      startup_id: 'junk',
      amount_usd: 8_000_000,
      announced_at: '2026-02-01T00:00:00Z',
      round_type: 'Seed',
      verification_status: 'verified',
    }],
  ]);
  const startupsById = new Map([
    ['bethog', { id: 'bethog', name: 'BetHog', entity_gate: 'qualified', status: 'approved' }],
    ['rumor', { id: 'rumor', name: 'Rumor Co', entity_gate: 'qualified', status: 'approved' }],
    ['junk', { id: 'junk', name: 'Example Ventures', entity_gate: 'junk', status: 'approved' }],
  ]);
  const deals = dealsFromLedger({
    investorId: bullpen,
    participants: [
      { investor_id: bullpen, funding_event_id: 'event-1', participant_role: 'participant' },
      { investor_id: bullpen, funding_event_id: 'event-2', participant_role: 'lead' },
      { investor_id: bullpen, funding_event_id: 'event-3', participant_role: 'lead' },
      { investor_id: 'someone-else', funding_event_id: 'event-1', participant_role: 'lead' },
    ],
    eventsById,
    startupsById,
  });
  assert.equal(deals.length, 1);
  assert.equal(deals[0].company, 'BetHog');
  assert.equal(deals[0].year, 2026);
  assert.equal(deals[0].round, 'Series A');
  assert.equal(deals[0].amount, 10_000_000);
  assert.equal(deals[0].source, 'funding_ledger');
});

test('news deals require a reviewed participant headline', () => {
  const investor = { name: 'Acme Ventures', firm: 'Acme Ventures' };
  const none = dealsFromEvidenceArticles([
    { title: 'Acme Ventures invests in Nova - Local Tech', link: 'https://local.example/nova', pubDate: 'Wed, 18 Mar 2026 12:00:00 GMT' },
  ], investor);
  assert.equal(none.length, 0);

  const deals = dealsFromEvidenceArticles([
    { title: 'Acme Ventures invests in Nova - Reuters', link: 'https://www.reuters.com/nova', pubDate: 'Wed, 18 Mar 2026 12:00:00 GMT' },
    { title: 'Nova raises a $30M round', link: 'https://www.reuters.com/other', pubDate: 'Wed, 18 Mar 2026 12:00:00 GMT' },
  ], investor);
  assert.deepEqual(deals.map((deal) => deal.company), ['Nova']);
  assert.equal(deals[0].year, 2026);
  assert.equal(deals[0].source, 'news');
  assert.equal(deals[0].source_url, 'https://www.reuters.com/nova');
});

test('firm site portfolio keeps labeled logos and drops untitled art', () => {
  const html = `
    <a href="https://www.betterleave.com"><img src="https://cdn.example/Betterleave.png"></a>
    <a href="https://chordcommerce.com/"><img src="https://cdn.example/Untitled+(3.7+x+3+in).png"></a>
    <a href="https://twitter.com/ChingonaVC"><img src="https://cdn.example/Twitter.png"></a>
    <a href="https://www.chingona.ventures/about"><img src="https://cdn.example/About.png"></a>
    <a href="https://example.com/logo"><img src="https://cdn.example/ChingonaLogo+BlackMedium.png"></a>
  `;
  const deals = dealsFromFirmSite(html, 'https://www.chingona.ventures/', { name: 'Chingona Ventures', firm: 'Chingona Ventures' });
  assert.deepEqual(deals.map((deal) => deal.company), ['Betterleave']);
  assert.equal(deals[0].source, 'firm_site');
  assert.equal(deals[0].amount, null);
});

test('profile patch merges new evidence and does not wipe an existing date', () => {
  const investor = {
    notable_investments: ['Amazon'],
    last_investment_date: '2024-01-01',
  };
  const patch = profilePatch(investor, [{
    company: 'BetHog',
    year: 2026,
    round: 'Series A',
    amount: 10_000_000,
    invested_at: '2026-04-22T12:15:00+00:00',
    source: 'funding_ledger',
  }]);
  assert.deepEqual(patch.notable_investments.map((deal) => deal.company), ['BetHog', 'Amazon']);
  assert.equal(patch.last_investment_date, undefined);
  assert.equal(mergeDeals(
    [{ company: 'Amazon', year: null }],
    [{ company: 'Amazon', year: 2020, round: 'Seed', amount: null }],
  )[0].year, 2020);
});

test('backfill agent reads the ledger before news and does not call a paid model', () => {
  const agent = readFileSync(new URL('../scripts/agents/investor-deal-backfill-agent.mjs', import.meta.url), 'utf8');
  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  assert.match(agent, /dealsFromLedger/);
  assert.match(agent, /funding_evidence_participants/);
  assert.match(agent, /created_at/);
  assert.match(agent, /dealsFromFirmSite/);
  assert.match(agent, /searchInvestorNews/);
  assert.match(agent, /--apply/);
  assert.doesNotMatch(agent, /openai|anthropic|gemini/i);
  assert.match(pkg, /investors:deals:backfill/);
});
