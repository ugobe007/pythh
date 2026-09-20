import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  syndicateLabelsFromBriefings,
  pickCanonicalBriefings,
  mergeRaiseBriefingsIntoStartup,
} = require('../lib/fundingRaiseBriefing.js');
const { extractPriorFunderLabels, collectPriorFunderIds } = require('../server/lib/frequentLedgerFunders.js');

const submit = readFileSync(new URL('../server/routes/instantSubmit.js', import.meta.url), 'utf8');

const purpose = {
  version: 'funding-intel-v4',
  source_url: 'https://example.com/wonderful-os',
  round: { amount_usd: 550_000_000, valuation_usd: 5_000_000_000 },
  why: { primary: 'use_of_proceeds' },
  startup: { problem: 'enterprises lack an AI OS', founders: ['Ada'], has_technical_cofounder: true },
  syndicate: {
    lead: { name: 'Index Ventures' },
    participants: [{ name: 'Sequoia Capital' }],
    check_mentions: [],
  },
};

test('readers drop headline junk and inverted raise>valuation amounts', () => {
  const { eventLooksResearchable, sanitizeBriefing } = require('../lib/fundingRaiseBriefing.js');
  assert.equal(eventLooksResearchable({
    startup_name_raw: 'Alta Business Loans Introduces',
    source_title: 'Alta Business Loans Introduces Secure Online Application for Eight Nationwide Business Financing Paths',
  }), false);
  const cleaned = sanitizeBriefing({
    why: { primary: 'cited_unclassified' },
    round: { amount_usd: 4_000_000_000, valuation_usd: 2_600_000_000 },
  });
  assert.equal(cleaned.round.amount_usd, null);
  assert.equal(cleaned.round.valuation_usd, 2_600_000_000);
});

test('canonical briefings ignore sibling copies and keep the purpose row', () => {
  const rows = pickCanonicalBriefings([
    {
      id: 'junk',
      startup_name_raw: 'Wonderful',
      amount_usd: 550_000_000,
      metadata: {
        raise_cluster: { role: 'sibling', canonical_event_id: 'good' },
        funding_intelligence: { why: { primary: 'unspecified' } },
      },
    },
    {
      id: 'good',
      startup_name_raw: 'Wonderful',
      amount_usd: 550_000_000,
      metadata: {
        raise_cluster: { role: 'canonical', key: 'wonderful|550000000|2026-09-03' },
        funding_intelligence: purpose,
      },
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event.id, 'good');
  assert.equal(rows[0].briefing.why.primary, 'use_of_proceeds');
});

test('merge folds syndicate into prior-funder labels without inventing GOD fields', () => {
  const merged = mergeRaiseBriefingsIntoStartup({
    id: 's1',
    name: 'Wonderful',
    extracted_data: { investors: ['Existing Angel'] },
  }, [{ briefing: purpose }]);
  assert.deepEqual(merged.extracted_data.funding_raise_syndicate.sort(), ['Index Ventures', 'Sequoia Capital'].sort());
  assert.ok(merged.extracted_data.investors.includes('Sequoia Capital'));
  assert.equal(merged.extracted_data.problem, 'enterprises lack an AI OS');
  assert.equal(merged.has_technical_cofounder, true);
  assert.deepEqual(extractPriorFunderLabels(merged).sort(), ['Existing Angel', 'Index Ventures', 'Sequoia Capital'].sort());

  const investors = [
    { id: 'i1', name: 'Sequoia Capital', firm: 'Sequoia Capital', investor_score: 90 },
    { id: 'i2', name: 'Other Fund', firm: 'Other Fund', investor_score: 80 },
  ];
  assert.deepEqual([...collectPriorFunderIds(investors, merged)], ['i1']);
});

test('syndicate labels skip empty names', () => {
  assert.deepEqual(syndicateLabelsFromBriefings([{ syndicate: { lead: { name: '' }, participants: [{}] } }]), []);
});

test('instant submit attaches canonical raise briefings before GOD and matching', () => {
  assert.match(submit, /attachCanonicalRaiseBriefings/);
  assert.doesNotMatch(submit, /GOD_SCORE_CONFIG/);
});
