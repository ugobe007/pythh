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
  eventDedupeKey,
  headlineQuality,
  pickRichestEvent,
  pickRichestPerRaise,
  selectResearchEvents,
  uniquePreview,
  formatPreviewRow,
} from '../lib/fundingEventResearchers.mjs';

const script = readFileSync(new URL('../scripts/research-funding-events.mjs', import.meta.url), 'utf8');
const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const sitePkg = readFileSync(new URL('../site/package.json', import.meta.url), 'utf8');
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

test('why funded reads to-revolutionize and for-purpose headlines', () => {
  const crusoe = researchWhyFunded({
    text: 'Crusoe Raises $3 Billion At A $30B Valuation To Revolutionize AI Data Centers',
  });
  assert.equal(crusoe.primary, 'use_of_proceeds');
  assert.match(crusoe.use_of_proceeds, /revolutionize/i);

  const stellar = researchWhyFunded({
    text: 'Stellar Alpina secures €160K from Venture Kick for in-space propulsion',
  });
  assert.equal(stellar.primary, 'use_of_proceeds');
  assert.match(stellar.use_of_proceeds, /in-space propulsion/i);
});

test('duplicate raises keep the purpose/valuation headline, not the roundup', () => {
  const wonderfulRoundup = {
    id: 'wonderful-roundup',
    startup_name_raw: 'Wonderful',
    amount_usd: 550_000_000,
    announced_at: '2026-09-18T18:00:00Z',
    source_title: 'Wonderful raises $550M, Mykhailo Fedorov’s new defencetech startup also closes a round',
  };
  const wonderfulPurpose = {
    id: 'wonderful-purpose',
    startup_name_raw: 'Wonderful',
    amount_usd: 550_000_000,
    announced_at: '2026-09-18T12:00:00Z',
    source_title: 'Wonderful raises $550M at $5B valuation to build AI operating system for enterprises',
  };
  const elucidTally = {
    id: 'elucid-tally',
    startup_name_raw: 'Elucid',
    amount_usd: 55_000_000,
    announced_at: '2026-09-17T20:00:00Z',
    source_title: 'Elucid Raises $55 Million Series D As Total Funding Reaches $185 Million',
  };
  const elucidPurpose = {
    id: 'elucid-purpose',
    startup_name_raw: 'Elucid',
    amount_usd: 55_000_000,
    announced_at: '2026-09-17T08:00:00Z',
    source_title: 'Elucid Raises $55M to Expand AI Cardiovascular Diagnostics',
  };

  assert.equal(researchWhyFunded({ text: wonderfulRoundup.source_title }).primary, 'unspecified');
  assert.equal(researchWhyFunded({ text: wonderfulPurpose.source_title }).primary, 'use_of_proceeds');
  assert.equal(researchWhyFunded({ text: elucidTally.source_title }).primary, 'unspecified');
  assert.equal(researchWhyFunded({ text: elucidPurpose.source_title }).primary, 'use_of_proceeds');

  assert.ok(headlineQuality(wonderfulPurpose) > headlineQuality(wonderfulRoundup));
  assert.ok(headlineQuality(elucidPurpose) > headlineQuality(elucidTally));
  assert.equal(pickRichestEvent([wonderfulRoundup, wonderfulPurpose]).id, 'wonderful-purpose');
  assert.equal(pickRichestEvent([elucidTally, elucidPurpose]).id, 'elucid-purpose');

  const collapsed = pickRichestPerRaise([
    wonderfulRoundup,
    elucidTally,
    wonderfulPurpose,
    elucidPurpose,
  ]);
  assert.deepEqual(collapsed.map((row) => row.id), ['wonderful-purpose', 'elucid-purpose']);
});

test('already-stamped purpose copies block leftover unspecified siblings', () => {
  const done = (event) => event.metadata?.funding_intelligence_version === FUNDING_INTEL_VERSION;
  const crusoePurpose = {
    id: 'crusoe-purpose',
    startup_name_raw: 'Crusoe',
    amount_usd: 3_000_000_000,
    announced_at: '2026-09-18T12:00:00Z',
    source_title: 'Crusoe Raises $3 Billion At A $30B Valuation To Revolutionize AI Data Centers',
    metadata: { funding_intelligence_version: FUNDING_INTEL_VERSION },
  };
  const crusoeBare = {
    id: 'crusoe-bare',
    startup_name_raw: 'Crusoe',
    amount_usd: 3_000_000_000,
    announced_at: '2026-09-18T18:00:00Z',
    source_title: 'Crusoe Raises $3 Billion At A $30B Valuation',
    metadata: {},
  };
  const guardioPurpose = {
    id: 'guardio-purpose',
    startup_name_raw: 'Guardio',
    amount_usd: 40_000_000,
    announced_at: '2026-09-16T10:00:00Z',
    source_title: 'Guardio raises $40M at $1.1B valuation to expand AI protection',
    metadata: { funding_intelligence_version: FUNDING_INTEL_VERSION },
  };
  const guardioBare = {
    id: 'guardio-bare',
    startup_name_raw: 'Guardio',
    amount_usd: 40_000_000,
    announced_at: '2026-09-16T20:00:00Z',
    source_title: 'Guardio raises $40M at $1.1B valuation',
    metadata: {},
  };
  const wonderfulRoundup = {
    id: 'wonderful-roundup',
    startup_name_raw: 'Wonderful',
    amount_usd: 550_000_000,
    announced_at: '2026-09-18T18:00:00Z',
    source_title: 'Wonderful raises $550M, Mykhailo Fedorov’s new defencetech startup also closes a round',
    metadata: { funding_intelligence_version: FUNDING_INTEL_VERSION },
  };
  const wonderfulPurpose = {
    id: 'wonderful-purpose',
    startup_name_raw: 'Wonderful',
    amount_usd: 550_000_000,
    announced_at: '2026-09-18T12:00:00Z',
    source_title: 'Wonderful raises $550M at $5B valuation to build AI operating system for enterprises',
    metadata: {},
  };

  const { selected, skipped_already, skipped_duplicate } = selectResearchEvents([
    crusoeBare,
    crusoePurpose,
    guardioBare,
    guardioPurpose,
    wonderfulRoundup,
    wonderfulPurpose,
  ], { limit: 10, isDone: done });

  assert.deepEqual(selected.map((row) => row.id), ['wonderful-purpose']);
  assert.equal(skipped_already, 2);
  assert.equal(skipped_duplicate, 3);
  assert.equal(researchWhyFunded({ text: crusoeBare.source_title }).primary, 'unspecified');
  assert.equal(researchWhyFunded({ text: crusoePurpose.source_title }).primary, 'use_of_proceeds');
});

test('sample lines are unique and print euro amounts', () => {
  const rows = uniquePreview([
    { startup: 'Crusoe', amount_usd: 3e9, valuation_usd: 3e10, why: 'use_of_proceeds', currency: 'USD' },
    { startup: 'Crusoe', amount_usd: 3e9, why: 'use_of_proceeds' },
    { startup: 'Stellar Alpina', amount_raw: 160000, currency: 'EUR', why: 'use_of_proceeds' },
  ], 8);
  assert.equal(rows.length, 2);
  assert.match(formatPreviewRow(rows[0]), /\$3B/);
  assert.match(formatPreviewRow(rows[1]), /€160K/);
  assert.equal(eventDedupeKey({
    startup_name_raw: 'Crusoe',
    amount_usd: 3000000000,
    announced_at: '2026-09-18T12:00:00Z',
  }), eventDedupeKey({
    startup_name_raw: 'Crusoe',
    amount_usd: 3000000000,
    announced_at: '2026-09-18T18:00:00Z',
  }));
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
  assert.equal(briefing.version, 'funding-intel-v3');
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
  assert.match(sitePkg, /"funding:research"/);
  assert.match(script, /process\.chdir\(repoRoot\)/);
  assert.match(script, /selectResearchEvents/);
  assert.match(loop, /funding:research/);
});
