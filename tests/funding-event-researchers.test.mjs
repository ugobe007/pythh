import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FUNDING_INTEL_VERSION,
  RESEARCHER_IDS,
  researchRoundEconomics,
  researchWhyFunded,
  researchProblemTeam,
  researchParticipation,
  researchFundingEvent,
  eventPatchFromBriefing,
  briefingHasSignal,
} from '../lib/fundingEventResearchers.mjs';

const script = readFileSync(new URL('../scripts/research-funding-events.mjs', import.meta.url), 'utf8');
const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const loop = readFileSync(new URL('../scripts/agents/resolution-loop-agent.mjs', import.meta.url), 'utf8');

const HEADLINE = [
  'Acme raises $40 million Series B at a $320 million valuation led by Sequoia Capital.',
  'The company is building software that helps hospitals cut billing errors.',
  'Founded by Jane Doe and CTO Alex Kim, the startup will use the proceeds to scale sales and hire engineers.',
  'Index Ventures invested $8 million. Jane said "we funded this team because growth and product-market fit were obvious."',
].join(' ');

test('round economics extracts amount, post-style valuation, and series-b', () => {
  const row = researchRoundEconomics({
    event: { source_title: HEADLINE },
    text: HEADLINE,
  });
  assert.equal(row.amount_usd, 40_000_000);
  assert.equal(row.valuation_usd, 320_000_000);
  assert.equal(row.round_type, 'series-b');
  assert.equal(row.instrument, 'equity');
  assert.match(String(row.lead_investor || ''), /Sequoia/i);
});

test('euro raises stay EUR and are not converted to USD', () => {
  const row = researchRoundEconomics({
    event: {},
    text: 'Stellar Alpina secures €160K from Venture Kick for in-space propulsion',
  });
  assert.equal(row.amount_usd, null);
  assert.equal(row.amount_raw, 160_000);
  assert.equal(row.currency, 'EUR');
});

test('valuation-only headline is not treated as the raise amount', () => {
  const text = 'HiddenLayer hits a $1 billion valuation after its latest round.';
  const row = researchRoundEconomics({ event: {}, text });
  assert.equal(row.amount_usd, null);
  assert.equal(row.valuation_usd, 1_000_000_000);
});

test('why funded finds PMF / growth and use of proceeds', () => {
  const row = researchWhyFunded({ text: HEADLINE });
  assert.ok(['revenue_growth', 'product_market_fit', 'use_of_proceeds', 'hiring', 'customer_growth'].includes(row.primary) || row.use_of_proceeds);
  assert.ok(row.use_of_proceeds);
  assert.match(row.use_of_proceeds, /scale sales|hire engineers/i);
});

test('problem/team researcher finds founders and a problem statement', () => {
  const row = researchProblemTeam({
    event: { startup_name_raw: 'Acme' },
    text: HEADLINE,
  });
  assert.ok(row.problem);
  assert.ok(row.founders.some((name) => /Jane Doe/i.test(name)) || row.founders.length >= 1);
});

test('participation researcher captures a named check', () => {
  const row = researchParticipation({
    participants: [
      { investor_name_raw: 'Sequoia Capital', investor_id: 'i1', participant_role: 'lead', resolution_status: 'resolved' },
      { investor_name_raw: 'Index Ventures', investor_id: 'i2', participant_role: 'participant', resolution_status: 'resolved' },
    ],
    text: HEADLINE,
  });
  assert.equal(row.lead?.name, 'Sequoia Capital');
  assert.equal(row.participants.length, 2);
  assert.ok(row.check_mentions.some((check) => check.amount_usd === 8_000_000 && /Index/i.test(check.investor_name)));
});

test('compose briefing + event patch fills only null amount/round', () => {
  const event = {
    id: 'e1',
    startup_name_raw: 'Acme',
    source_title: HEADLINE,
    source_url: 'https://techcrunch.com/acme',
    amount_usd: null,
    round_type: null,
    metadata: { existing: true },
  };
  const briefing = researchFundingEvent(event, [
    { investor_name_raw: 'Sequoia Capital', participant_role: 'lead', resolution_status: 'resolved' },
  ]);
  assert.equal(briefing.version, FUNDING_INTEL_VERSION);
  assert.deepEqual(RESEARCHER_IDS.slice().sort(), Object.keys(briefing.researchers).sort());
  assert.equal(briefingHasSignal(briefing), true);
  const patch = eventPatchFromBriefing(event, briefing);
  assert.equal(patch.amount_usd, 40_000_000);
  assert.equal(patch.round_type, 'series-b');
  assert.equal(patch.metadata.existing, true);
  assert.equal(patch.metadata.funding_intelligence_version, FUNDING_INTEL_VERSION);

  const alreadyFilled = eventPatchFromBriefing({ ...event, amount_usd: 1, round_type: 'seed' }, briefing);
  assert.equal(alreadyFilled.amount_usd, undefined);
  assert.equal(alreadyFilled.round_type, undefined);
});

test('orchestrator is free-first and does not retune GOD or rematch', () => {
  assert.match(script, /funding-event-researchers/);
  assert.match(script, /provider === 'cascade'/);
  assert.match(script, /Does NOT/);
  assert.doesNotMatch(script, /calculateHotScore/);
  assert.doesNotMatch(script, /GOD_SCORE_CONFIG/);
  assert.doesNotMatch(script, /delete from startup_investor_matches/i);
  assert.match(pkg, /"funding:research"/);
  assert.match(pkg, /"funding:research:apply"/);
  assert.match(loop, /funding:research/);
});
