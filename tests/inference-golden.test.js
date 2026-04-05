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

test('scoreNarrativeRole: possessive + subject across variants', () => {
  const p = scoreNarrativeRole("Smith's CEO discussed guidance.", "Smith's");
  assert(p.frames.includes('possessive') && p.score >= 0.85, String(p.score));
  const s = scoreNarrativeRole('Smith raises $10M Series A.', "Smith's");
  assert(s.frames.includes('subject') && s.score >= 0.89, JSON.stringify(s));
});

console.log('\nAll inference golden tests passed.\n');
