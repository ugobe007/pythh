import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  extractFundingAttentionAspects,
  announcementTextFromEvent,
  aspectThemes,
  primarySignalsForAspects,
  inferFundingTriggers,
  FUNDING_ATTENTION_VERSION,
} from '../lib/fundingAttentionAspects.mjs';
import {
  mergeObservedThesis,
  investorSignalsPatch,
  hasObservationForEvent,
} from '../lib/fundingAttentionObservedThesis.mjs';

const require = createRequire(import.meta.url);
const { calculateInvestorScore } = require('../lib/investorGodScore.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(here, rel), 'utf8');

test('extracts customer growth, hiring, unique tech, board, partners, and product', () => {
  const text = [
    'Acme raises $40M Series B, citing customer growth to 2,000 logos and $20M ARR.',
    'The company is hiring senior engineers and appointed a new CTO.',
    'Investors pointed to its proprietary platform and unique technology.',
    'The lead joins the board of directors.',
    'Acme partnered with Salesforce on a strategic partnership.',
    'It launched a new product version last month.',
  ].join(' ');
  const { aspects, cited } = extractFundingAttentionAspects(text);
  const ids = aspects.map((row) => row.id);
  assert.ok(ids.includes('customer_growth'));
  assert.ok(ids.includes('hiring'));
  assert.ok(ids.includes('unique_tech'));
  assert.ok(ids.includes('board'));
  assert.ok(ids.includes('partners'));
  assert.ok(ids.includes('product_rev'));
  assert.equal(cited, true);
});

test('does not treat firm-name Partners or onboard/keyboard as aspects', () => {
  const { aspects } = extractFundingAttentionAspects(
    'Insight Partners and Sequoia onboard the dashboard at Keyboard Labs.',
  );
  assert.equal(aspects.some((row) => row.id === 'partners'), false);
  assert.equal(aspects.some((row) => row.id === 'board'), false);
});

test('ignores hiring freeze / not hiring', () => {
  const { aspects } = extractFundingAttentionAspects(
    'The startup announced a hiring freeze and is not hiring engineers.',
  );
  assert.equal(aspects.some((row) => row.id === 'hiring'), false);
});

test('announcementTextFromEvent concatenates title and funding excerpt', () => {
  const text = announcementTextFromEvent({
    source_title: 'Nova raises $12M',
    metadata: { funding_evidence_excerpt: 'The company raised the round citing customer growth and a new product launch' },
  });
  const { aspects } = extractFundingAttentionAspects(text);
  assert.ok(aspectThemes(aspects).includes('customer growth'));
  assert.ok(primarySignalsForAspects(aspects).includes('revenue_signal'));
});

test('drops aggregator sidebar excerpts that do not mention the startup', () => {
  const { aspects } = extractFundingAttentionAspects(announcementTextFromEvent({
    startup_name_raw: 'HiddenLayer',
    source_title: 'HiddenLayer Raises $100M Series B',
    metadata: {
      funding_evidence_excerpt: '10 Best Decentralized Crypto Exchanges (DEXs) in 2026\n10 Best Crypto Mining App Options',
    },
  }));
  assert.equal(aspects.some((row) => row.id === 'customer_growth'), false);
});

test('extracts revenue growth, product-market fit, and customer-access partnerships', () => {
  const revenue = extractFundingAttentionAspects(
    'Nova raises $40M after 3x ARR growth and year-over-year revenue growth.',
  );
  assert.ok(revenue.aspects.some((row) => row.id === 'revenue_growth'));
  assert.equal(inferFundingTriggers(revenue).primary, 'revenue_growth');

  const pmf = extractFundingAttentionAspects(
    'Investors cited unique product-market fit and inbound demand from the waitlist.',
  );
  assert.ok(pmf.aspects.some((row) => row.id === 'product_market_fit'));

  const access = extractFundingAttentionAspects(
    'The startup partnered with Salesforce to reach enterprise customers and signed a distribution partnership.',
  );
  assert.ok(access.aspects.some((row) => row.id === 'customer_access_partnership'));

  const firmName = extractFundingAttentionAspects('Insight Partners leads the Series B.');
  assert.equal(firmName.aspects.some((row) => row.id === 'customer_access_partnership'), false);
  assert.equal(firmName.aspects.some((row) => row.id === 'partners'), false);
});

test('reads raise-to-purpose and launch headlines', () => {
  const purpose = extractFundingAttentionAspects(
    'Wonderful raises $550M at $5B valuation to build AI operating system for enterprises',
  );
  assert.ok(purpose.aspects.some((row) => row.id === 'use_of_proceeds'));

  const launch = extractFundingAttentionAspects(
    'Thyme Care Raises $125M, Launches New Oncology Parent Entity',
  );
  assert.ok(launch.aspects.some((row) => row.id === 'product_rev'));

  const excerpt = extractFundingAttentionAspects({
    source_title: 'HyImpulse Raises More Than €50 Million',
    body: 'HyImpulse focuses on innovative proprietary hybrid propulsion technology and plans to use the funding to expand.',
  });
  assert.ok(excerpt.aspects.some((row) => row.id === 'unique_tech'));
  assert.ok(excerpt.aspects.some((row) => row.id === 'use_of_proceeds'));
});

test('mergeObservedThesis is additive, idempotent per event, and never writes thesis', () => {
  const first = mergeObservedThesis(
    { top_themes: ['ai'] },
    {
      eventId: 'evt-1',
      aspects: [{ id: 'hiring', theme: 'hiring', confidence: 0.7 }],
      coInvestors: [{ investor_id: 'b', name: 'Beta Ventures' }],
      sourceUrl: 'https://techcrunch.com/nova',
      announcedAt: '2026-08-01',
      startupName: 'Nova',
    },
  );
  assert.deepEqual(first.top_themes.sort(), ['ai', 'hiring']);
  assert.equal(first.observed_thesis.aspects.hiring.count, 1);
  assert.equal(first.investment_thesis, undefined);
  assert.equal(hasObservationForEvent(first, 'evt-1'), true);

  const again = mergeObservedThesis(first, {
    eventId: 'evt-1',
    aspects: [{ id: 'hiring', theme: 'hiring', confidence: 0.8 }],
    coInvestors: [{ investor_id: 'b', name: 'Beta Ventures' }],
    announcedAt: '2026-08-01',
  });
  assert.equal(again.observed_thesis.aspects.hiring.count, 1);

  const patch = investorSignalsPatch(again, {
    eventId: 'evt-2',
    aspects: [{ id: 'customer_growth', theme: 'customer growth' }],
    announcedAt: '2026-09-01',
  });
  assert.equal(Object.keys(patch).join(','), 'signals');
  assert.ok(patch.signals.top_themes.includes('customer growth'));
  assert.equal(patch.investment_thesis, undefined);
});

test('adding observed themes can lift investor profile completeness without changing bucket caps', () => {
  const bare = {
    name: 'Acme Ventures',
    firm: 'Acme Ventures',
    bio: 'A',
    investment_thesis: '',
    signals: {},
  };
  const filled = {
    ...bare,
    signals: mergeObservedThesis({}, {
      eventId: 'evt-1',
      aspects: [
        { id: 'hiring', theme: 'hiring' },
        { id: 'customer_growth', theme: 'customer growth' },
        { id: 'unique_tech', theme: 'unique technology' },
      ],
    }),
  };
  const before = calculateInvestorScore(bare);
  const after = calculateInvestorScore(filled);
  assert.ok(after.breakdown.profile >= before.breakdown.profile);
  assert.ok(after.breakdown.profile <= 25);
  assert.ok(after.total <= 100);
});

test('agent and helpers never retune GOD_SCORE_CONFIG or write investment_thesis', () => {
  const agent = read('../scripts/research-funding-attention.mjs');
  const aspects = read('../lib/fundingAttentionAspects.mjs');
  const merge = read('../lib/fundingAttentionObservedThesis.mjs');
  const scoring = read('../server/services/startupScoringService.ts');
  const weights = JSON.parse(read('../server/config/god-score-weights.json'));

  assert.equal(FUNDING_ATTENTION_VERSION, 'funding-attention-v2');
  assert.match(agent, /investment_thesis is never written/);
  assert.doesNotMatch(agent, /investment_thesis:/);
  assert.doesNotMatch(agent, /GOD_SCORE_CONFIG\s*=/);
  assert.doesNotMatch(aspects, /GOD_SCORE_CONFIG/);
  assert.doesNotMatch(merge, /investment_thesis:/);
  assert.match(scoring, /const GOD_SCORE_CONFIG = \{/);
  assert.equal(weights.weights.componentWeights.team, 0.22);
  assert.equal(weights.weights.componentWeights.traction, 0.3);
  assert.equal(weights.weights.componentWeights.market, 0.2);
  assert.equal(weights.weights.componentWeights.product, 0.15);
  assert.equal(weights.weights.componentWeights.vision, 0.13);
});
