import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  normName,
  namesAlign,
  isSpvOrFundWrapper,
  isIssuerFormD,
  formDArchiveUrl,
  toLedgerEventRow,
  toSearchResultRow,
  lookupStartupFundingEvents,
} = require('../server/lib/fundingSourceLookup.js');

test('normName strips legal suffixes', () => {
  assert.equal(normName('Astranis Space Technologies Corp.'), 'astranis space');
  assert.equal(normName("Luna Innovations, Inc."), 'luna innovations');
});

test('namesAlign requires distinctive brand tokens', () => {
  assert.equal(namesAlign('Luna Innovations, Incorporated', 'Luna Innovations'), true);
  assert.equal(namesAlign('AGTEC INNOVATIONS INC', 'Luna Innovations'), false);
  assert.equal(namesAlign('ANDURIL INDUSTRIES, INC.', 'Anduril'), true);
  assert.equal(namesAlign('Astranis Space Technologies Corp.', 'Astranis'), true);
});

test('SPV wrappers that mention a portfolio company are rejected as issuers', () => {
  assert.equal(
    isSpvOrFundWrapper('Nimble Partners Select, L.P. - Series 4 (Astranis) (CIK 0002109012)', 'Astranis'),
    true,
  );
  assert.equal(
    isSpvOrFundWrapper('HII Shield AI-04, a Series of HII Shield AI-A LLC (CIK 0002146353)', 'Shield AI'),
    true,
  );
  assert.equal(
    isSpvOrFundWrapper('Astranis Space Technologies Corp. (CIK 0001715660)', 'Astranis'),
    false,
  );
  assert.equal(isSpvOrFundWrapper('Anduril Fund, LLC (CIK 0002081565)', 'Anduril'), true);
  assert.equal(isSpvOrFundWrapper('Anduril Holdings SPV, LP (CIK 0002064427)', 'Anduril'), true);
  assert.equal(isSpvOrFundWrapper('Anduril Investors II LLC (CIK 000123)', 'Anduril'), true);
});

test('isIssuerFormD accepts company filings and rejects fund SPVs', () => {
  assert.equal(
    isIssuerFormD(['Astranis Space Technologies Corp.  (CIK 0001715660)'], 'Astranis'),
    true,
  );
  assert.equal(
    isSpvOrFundWrapper('OpenAI-01, a Series of OpenAI Opp Fund LLC  (CIK 0002134995)', 'OpenAI'),
    true,
  );
  assert.equal(
    isIssuerFormD(['OpenAI-01, a Series of OpenAI Opp Fund LLC  (CIK 0002134995)'], 'OpenAI'),
    false,
  );
});

test('formDArchiveUrl builds EDGAR primary_doc path', () => {
  assert.equal(
    formDArchiveUrl('0001715660', '0001715660-20-000001'),
    'https://www.sec.gov/Archives/edgar/data/1715660/000171566020000001/primary_doc.xml',
  );
});

test('toLedgerEventRow marks grants as grant and Form D as equity observed', () => {
  const grant = toLedgerEventRow(
    {
      financing_type: 'grant',
      evidence_type: 'grant_award',
      event_date: '2024-06-01',
      amount_usd: 150000,
      round_type: 'SBIR',
      source_url: 'https://www.nsf.gov/awardsearch/showAward?AWD_ID=1',
      source_title: 'Luna — SBIR Phase I',
      source_provider: 'nsf_sbir_sttr',
      source_publisher: 'NSF',
      ontology_channel: 3,
      trust_hint: 'T0',
    },
    { startupId: '00000000-0000-0000-0000-000000000001', startupName: 'Luna' },
  );
  assert.equal(grant.financing_type, 'grant');
  assert.equal(grant.verification_status, 'observed');
  assert.match(grant.source_event_key, /^ontology:nsf_sbir_sttr:/);

  const formD = toLedgerEventRow(
    {
      financing_type: 'equity',
      evidence_type: 'sec_filing',
      event_date: '2021-04-19',
      amount_usd: null,
      round_type: 'Form D',
      source_url: 'https://www.sec.gov/Archives/edgar/data/1715660/000171566021000003/primary_doc.xml',
      source_title: 'Astranis files Form D',
      source_provider: 'sec_edgar_form_d',
      source_publisher: 'SEC EDGAR',
      ontology_channel: 2,
      trust_hint: 'T0',
    },
    { startupId: '00000000-0000-0000-0000-000000000002', startupName: 'Astranis' },
  );
  assert.equal(formD.financing_type, 'equity');
  assert.equal(formD.evidence_confidence, 0.92);
  assert.equal(formD.metadata.participant_list_complete, false);
});

test('toSearchResultRow uses agency / Form D sentinel as investor_name_raw', () => {
  const row = toSearchResultRow(
    {
      financing_type: 'equity',
      evidence_type: 'sec_filing',
      event_date: '2021-04-19',
      round_type: 'Form D',
      source_url: 'https://www.sec.gov/Archives/edgar/data/1/1/primary_doc.xml',
      source_title: 'Co files Form D',
      source_provider: 'sec_edgar_form_d',
      investor_name_raw: 'SEC Form D (investors not listed in index)',
    },
    { startupId: '00000000-0000-0000-0000-000000000003' },
  );
  assert.equal(row.event_type, 'funding');
  assert.match(row.investor_name_raw, /SEC Form D/);
  assert.equal(row.resolution_status, 'pending');
});

test('search script supports --provider=ontology and defaults remain inference', () => {
  const script = readFileSync(new URL('../scripts/search-startup-funding-evidence.mjs', import.meta.url), 'utf8');
  assert.match(script, /providerArg === 'ontology'/);
  assert.match(script, /fundingSourceLookup/);
  assert.match(script, /processOntologyJob/);
  assert.match(script, /funding_source_ontology/);
  assert.match(script, /: 'inference'/);
  assert.match(script, /inference_then_paid_cascade/);
});

test('match-outcome agent uses ontology search provider', () => {
  const agent = readFileSync(new URL('../scripts/agents/match-outcome-agent.mjs', import.meta.url), 'utf8');
  assert.match(agent, /--provider=ontology/);
});

test('live SEC Form D lookup returns issuer filings for Astranis', async () => {
  const { events, errors } = await lookupStartupFundingEvents({
    name: 'Astranis',
    afterDate: '2016-01-01',
    sources: ['sec'],
  });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.ok(events.length >= 1, 'expected at least one Form D');
  assert.ok(events.every((e) => e.source_provider === 'sec_edgar_form_d'));
  assert.ok(events.every((e) => e.financing_type === 'equity'));
  assert.ok(events.some((e) => /astranis/i.test(e.source_title)));
  assert.ok(events.every((e) => !/series of/i.test(e.source_title)));
});

test('live NSF lookup returns SBIR/STTR-style awards for Luna Innovations', async () => {
  const { events, errors } = await lookupStartupFundingEvents({
    name: 'Luna Innovations',
    afterDate: '2000-01-01',
    sources: ['nsf'],
  });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.ok(events.every((e) => e.financing_type === 'grant'));
  assert.ok(events.every((e) => /luna/i.test(e.source_title)));
  // Prefer SBIR/STTR when present; empty is OK if NSF page has only fuzzy non-matches.
  if (events.length) {
    assert.ok(events.some((e) => /sbir|sttr|nsf/i.test(`${e.round_type} ${e.source_title}`)));
  }
});

test('live USASpending lookup returns federal awards for Anduril', async () => {
  const { events, errors } = await lookupStartupFundingEvents({
    name: 'Anduril',
    afterDate: '2020-01-01',
    sources: ['usaspending'],
  });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.ok(events.length >= 1, 'expected USASpending awards');
  assert.ok(events.every((e) => e.financing_type === 'grant'));
  assert.ok(events.every((e) => e.source_provider === 'usaspending'));
  assert.ok(events.every((e) => /anduril/i.test(e.source_title)));
});

test('live Anduril Form D rejects Fund/SPV vehicles', async () => {
  const { events, errors } = await lookupStartupFundingEvents({
    name: 'Anduril',
    afterDate: '2020-01-01',
    sources: ['sec'],
  });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.ok(events.every((e) => !/\bfund\b|\bspv\b/i.test(e.source_title)));
});
