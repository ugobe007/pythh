#!/usr/bin/env node
'use strict';
/**
 * scripts/test-signal-parsing.js
 *
 * Regression test suite for the signal parsing + event builder pipeline.
 * Run after any change to signalOntology.js, signalParser.js, or signalEventBuilder.js.
 *
 * Usage:
 *   node scripts/test-signal-parsing.js
 *
 * Exit code 0 = all passing. Exit code 1 = failures detected.
 *
 * Each test: [label, text, expected_primary, expected_neg, alts_include[], alts_exclude[]]
 *
 * alts_include = these signal classes must appear in alternate_signals
 * alts_exclude = these signal classes must NOT appear in alternate_signals (gate enforcement)
 */

const { parseSignal }       = require('../lib/signalParser');
const { buildSignalEvent }  = require('../lib/signalEventBuilder');

const CASES = [
  // ── Active signals (should classify clearly, no gating) ─────────────────────
  ['Active fundraising',
    'Acme raised $5M Series A from Sequoia.',
    'fundraising_signal', false, [], ['exploratory_signal']],

  ['Active hiring',
    'We are aggressively hiring senior enterprise sales engineers.',
    'hiring_signal', false, [], ['exploratory_signal']],

  ['Active product launch',
    'We launched our enterprise product at Dreamforce.',
    'product_signal', false, [], []],

  ['Revenue signal',
    'We crossed $2M ARR this quarter with 40 enterprise customers.',
    'revenue_signal', false, [], []],

  ['Distress signal',
    'We extended our runway by cutting 20% of the team.',
    'distress_signal', false, [], []],

  ['Acquisition signal (high priority)',
    'The company was acquired by Microsoft for $2B.',
    'acquisition_signal', false, [], []],

  // ── Modal-past gate semantics ─────────────────────────────────────────────────
  // The fundraising/hiring/product pattern fires BUT must be gated out.
  ['Modal-past: had planned to raise',
    'We had planned to raise a Series B but pivoted.',
    'exploratory_signal', false, [], ['fundraising_signal']],

  ['Modal-past: had intended to hire',
    'The company had intended to hire 50 engineers last year.',
    'exploratory_signal', false, [], ['hiring_signal']],

  ['Modal-past: was hoping to launch',
    'She was hoping to launch the product last quarter.',
    'exploratory_signal', false, [], ['product_signal']],

  // ── Negation ──────────────────────────────────────────────────────────────────
  // Negated signals: primary = negated_signal, has_negation = true, alts = []
  ['Explicit negation: not raising',
    'We are not raising a round at this time.',
    'negated_signal', true, [], ['fundraising_signal']],

  ['Negation with adverb: absolutely not raising',
    'We are absolutely not raising capital right now.',
    'negated_signal', true, [], ['fundraising_signal']],

  ['Negation with adverb: definitely not considering',
    'We are definitely not considering an acquisition.',
    'negated_signal', true, [], ['acquisition_signal']],

  // ── Hedged / exploratory language ─────────────────────────────────────────────
  ['Hedged intent: may consider raising',
    'We may consider raising a Series A next year.',
    'exploratory_signal', false, [], ['fundraising_signal']],

  ['Exploratory evaluate',
    'We are evaluating our strategic options for growth.',
    'exploratory_signal', false, [], []],

  // ── "Strategic alternatives" = coded exit language ────────────────────────────
  // "Strategic alternatives" is M&A coded language. exit_signal is correct.
  // The word "exploring" fires exploratory_signal, but "strategic alternatives"
  // fires exit_signal which ranks higher. This is intentional.
  ['Strategic alternatives = exit signal',
    'We are exploring strategic alternatives.',
    'exit_signal', false, [], []],

  // ── Multi-signal compound ─────────────────────────────────────────────────────
  ['Multi-signal: fundraising + hiring',
    'After closing our seed round, we are aggressively hiring engineers.',
    'fundraising_signal', false, ['hiring_signal'], []],

  // ── Builder contract checks ───────────────────────────────────────────────────
  // These just verify buildSignalEvent() maps all fields correctly.
  ['Builder: is_ambiguous is boolean',
    'We might explore a strategic partnership at some point.',
    null, false, [], []],

  ['Builder: sub_signals is array',
    'We closed our Series A and are now hiring aggressively.',
    null, false, [], []],
];

let passed = 0;
let failed = 0;

console.log('\n🔬 Signal Parsing Regression Tests');
console.log('═'.repeat(60));

for (const [label, text, expectedPrimary, expectedNeg,
           expectedAltsInclude, expectedAltsExclude] of CASES) {
  const sig = parseSignal(text);
  const row = buildSignalEvent(sig, {
    entityId:    'test-entity-001',
    rawSentence: text,
    sourceType:  'rss_scrape',
    detectedAt:  new Date().toISOString(),
  });

  const errors = [];

  if (expectedPrimary && row.primary_signal !== expectedPrimary) {
    errors.push(`primary: got "${row.primary_signal}", want "${expectedPrimary}"`);
  }

  if (row.has_negation !== expectedNeg) {
    errors.push(`has_negation: got ${row.has_negation}, want ${expectedNeg}`);
  }

  const altClasses = (sig.alternate_signals || []).map(a => a.class);

  for (const cls of expectedAltsInclude) {
    if (!altClasses.includes(cls)) {
      errors.push(`alts should include "${cls}" — got [${altClasses.join(', ')}]`);
    }
  }

  for (const cls of expectedAltsExclude) {
    if (altClasses.includes(cls)) {
      errors.push(`gate violation: "${cls}" leaked into alternate_signals`);
    }
  }

  // Builder contract invariants — these should never fail
  if (row.entity_id !== 'test-entity-001')
    errors.push('entity_id not mapped');
  if (row.raw_sentence !== text)
    errors.push('raw_sentence not mapped');
  if (typeof row.is_ambiguous !== 'boolean')
    errors.push('is_ambiguous must be boolean');
  if (!Array.isArray(row.intensity))
    errors.push('intensity must be array');
  if (!Array.isArray(row.sub_signals))
    errors.push('sub_signals must be array');
  if (!Array.isArray(row.likely_needs))
    errors.push('likely_needs must be array');

  if (errors.length === 0) {
    passed++;
    console.log(`✓ PASS  ${label}`);
  } else {
    failed++;
    console.log(`✗ FAIL  ${label}`);
    errors.forEach(e => console.log(`       → ${e}`));
  }
}

console.log('═'.repeat(60));
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Failing tests must be fixed before running --apply on any ingest script.\n');
  process.exit(1);
} else {
  console.log('\n✅ All tests passing. Safe to proceed.\n');
}
