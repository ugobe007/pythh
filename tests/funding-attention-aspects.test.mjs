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

test('announcementTextFromEvent concatenates title and metadata excerpt', () => {
  const text = announcementTextFromEvent({
    source_title: 'Nova raises $12M',
    metadata: { excerpt: 'citing customer growth and a new product launch' },
  });
  const { aspects } = extractFundingAttentionAspects(text);
  assert.ok(aspectThemes(aspects).includes('customer growth'));
  assert.ok(primarySignalsForAspects(aspects).includes('revenue_signal'));
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
