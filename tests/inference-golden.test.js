/**
 * Golden checks for news inference + ontology parsing (no network).
 * Run: node tests/inference-golden.test.js
 */

'use strict';

const assert = require('assert');
const { extractFunding } = require('../lib/inference-extractor');
const { parseSignal } = require('../lib/signalParser');
const { extractOntologyFromNewsText } = require('../lib/ontologyNewsInference');
const { dedupeAndRankArticles } = require('../lib/articleDedupe');
const { inferNeeds } = require('../lib/needsInference');
const { primarySearchToken, scoreNarrativeRole } = require('../server/services/inferenceService');
const { extractDealCompanyMentions } = require('../lib/rssDealMentions');
const { matchFundingContext, textHasDealLanguage } = require('../lib/fundingEventLexicon');
const { analyzeFundingEventFrame } = require('../lib/fundingEventFrame');
const { classifyEntityTrack } = require('../lib/startupNameLogicEngine');
const { evaluateStartupNameForPipeline } = require('../lib/entityResolutionGate');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

test('extractFunding parses headline millions', () => {
  const t = 'Acme raises $15 million Series B to expand in Europe';
  const f = extractFunding(t);
  assert(f.funding_amount > 14e6 && f.funding_amount < 16e6, 'amount ~15M');
});

test('parseSignal classifies fundraising with news_article source', () => {
  const s = parseSignal('The startup closed $8M in seed funding.', { source_type: 'news_article' });
  assert(s && s.primary_signal === 'fundraising_signal', s && s.primary_signal);
});

test('extractOntologyFromNewsText returns classes', () => {
  const r = extractOntologyFromNewsText(
    'BetaCo raised $12M in Series A. The company expanded into APAC.',
    { maxSentences: 10 },
  );
  assert(r && r.signal_classes.length >= 1, 'expected signal_classes');
});

test('dedupeAndRankArticles collapses duplicate titles', () => {
  const d = dedupeAndRankArticles([
    { title: 'Same Headline Here', content: 'short', link: 'http://a' },
    { title: 'Same Headline Here!', content: 'much longer body text ' + 'x'.repeat(200), link: 'http://b' },
  ]);
  assert.strictEqual(d.length, 1);
  assert(d[0].link === 'http://b' || d[0].content.length > 50, 'keeps richer article');
});

test('inferNeeds merges enrichment ontology', () => {
  const needs = inferNeeds(
    [],
    {
      dominant_trajectory: 'unknown',
      trajectory_confidence: 0.4,
      velocity_score: 0.5,
      acceleration: 'stable',
      matched_patterns: [],
    },
    {
      min_confidence: 0.2,
      enrichment: {
        ontology_inference: {
          signal_classes: [{ signal_class: 'fundraising_signal', best_certainty: 0.9, snippet: 'x', meaning: null }],
          inferred_strategic_needs: ['CRM'],
          detectedAt: new Date().toISOString(),
        },
        market_signals: { primarySignal: 'ACTIVELY_RAISING', signals: [{ signal: 'ACTIVELY_RAISING', score: 0.8 }] },
      },
    },
  );
  assert(needs.length > 0, 'expected at least one need from enrichment-only path');
});

test('primarySearchToken strips possessive', () => {
  assert.strictEqual(primarySearchToken("Acme's"), 'Acme');
  assert.strictEqual(primarySearchToken('Beta\u2019s'), 'Beta'); // Unicode apostrophe
  assert.strictEqual(primarySearchToken("WidgetCo's"), 'WidgetCo');
  assert.strictEqual(primarySearchToken('X\u2019s'), 'X\u2019s'); // bare too short; keep full string
});

test('fundingEventLexicon matches past and active deal language', () => {
  const past = 'The merger closed and the target later completed its IPO.';
  const m1 = matchFundingContext(past);
  assert(m1.hasStrongContext, 'expected merger + ipo');
  const groups1 = new Set(m1.matches.map((x) => x.group));
  assert(groups1.has('completed_or_past'), JSON.stringify(m1.matches));

  const active = 'Sequoia is investing in Nebula and joining the round alongside a16z.';
  const m2 = matchFundingContext(active);
  assert(m2.hasStrongContext, 'expected investing in + joining the round');
  const groups2 = new Set(m2.matches.map((x) => x.group));
  assert(groups2.has('active_investor_or_deal'), JSON.stringify(m2.matches));

  assert(!textHasDealLanguage('Random words about pizza and weather'), 'junk should lack deal language');
  assert(textHasDealLanguage('unicorn valuation round deal'), 'two+ weak tokens can count');
});

test('fundingEventFrame builds string + verb associations from event-shaped rows', () => {
  const fr = analyzeFundingEventFrame({
    source_title: 'Acme raised Series B',
    subject: null,
    object: null,
    semantic_context: [{ text: 'investors included BigCo Ventures' }],
  });
  assert(fr.hasStrongDealContext || fr.hasDealLanguage, JSON.stringify(fr));
  assert(fr.string.includes('Acme') && fr.string.includes('investors'), fr.string);
});

test('logic engine: single-token RSS fragments are descriptor, real brands pass', () => {
  assert.strictEqual(classifyEntityTrack('Todo').track, 'descriptor');
  assert.strictEqual(classifyEntityTrack('Percentage').track, 'descriptor');
  assert.strictEqual(classifyEntityTrack('Wikipedia').track, 'descriptor');
  assert(!evaluateStartupNameForPipeline('Todo').ok);
  assert(!evaluateStartupNameForPipeline('Readme').ok);
  assert(evaluateStartupNameForPipeline('Notion').ok);
  assert(evaluateStartupNameForPipeline('Stripe').ok);
});

test('logic engine: headline / phrase junk from admin edit list is not a startup', () => {
  const junk = [
    'Free Support',
    'Each',
    'With Banking Tool',
    'A Hundred Hands',
    'Family Vehicle',
    'Canton Fair Phase',
    'Universe Makes European',
    'Bold',
    'Claims',
    'US Stocks Trading Segment',
    'Grow Venture',
    'Auto China',
    'Never Upload Yours',
  ];
  for (const n of junk) {
    const ev = evaluateStartupNameForPipeline(n);
    assert(!ev.ok, `expected junk "${n}" → ok; got ${JSON.stringify(ev)}`);
  }
});

test('logic engine: opener list avoids false positives on known real brands', () => {
  assert(evaluateStartupNameForPipeline('Another Tomorrow').ok);
  assert(evaluateStartupNameForPipeline('Via Transportation').ok);
});

test('rssDealMentions extracts multiple companies from wire-style blurbs', () => {
  const t =
    'Sequoia just invested $5M in Gitlabs, a program that develops apps from repositories, ' +
    'but did not invest in Smithery since they did not see the value.';
  const m = extractDealCompanyMentions(t);
  assert(m.includes('Gitlabs'), `expected Gitlabs, got ${JSON.stringify(m)}`);
  assert(m.includes('Smithery'), `expected Smithery, got ${JSON.stringify(m)}`);
});

test('scoreNarrativeRole: possessive + subject across variants', () => {
  const p = scoreNarrativeRole("Smith's CEO discussed guidance.", "Smith's");
  assert(p.frames.includes('possessive') && p.score >= 0.85, String(p.score));
  const s = scoreNarrativeRole('Smith raises $10M Series A.', "Smith's");
  assert(s.frames.includes('subject') && s.score >= 0.89, JSON.stringify(s));
});

console.log('\nAll inference golden tests passed.\n');
