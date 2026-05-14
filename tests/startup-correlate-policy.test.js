/**
 * Golden tests — startup URL / description correlate policy (no network).
 * Run: node tests/startup-correlate-policy.test.js
 */

'use strict';

const assert = require('assert');
const { evaluateStartupCorrelatePolicy } = require('../lib/startupCorrelatePolicy');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

const longDeal =
  'Acme Data just inked a deal with Google to handle their data pipeline and expand enterprise coverage. ' +
  'The partnership spans multiple regions and includes technical integration work.';

test('accept: URL alone (name gate passes)', () => {
  const r = evaluateStartupCorrelatePolicy({
    name: 'Acme Labs',
    website: 'https://acme.example',
    description: '',
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.channel, 'url');
});

test('accept: deal + anchored description, no URL', () => {
  const r = evaluateStartupCorrelatePolicy({
    name: 'Acme Data',
    description: longDeal,
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.channel, 'description');
  assert.strictEqual(r.checks.company_narrative, true);
});

test('accept: professor commentary + product verbs (Georgia Tech style)', () => {
  const text =
    'Leading professor on AI at Georgia Tech believes NebulaOps has a chance to streamline agent workflows ' +
    'by removing ambiguities in language models for enterprise teams. The view is based on early benchmarks ' +
    'and customer design partners in fintech.';
  const r = evaluateStartupCorrelatePolicy({
    name: 'NebulaOps',
    description: text,
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.channel, 'description');
});

test('reject: pure physics / MIT headline (no company deal), no URL', () => {
  const text =
    'Research at MIT shows incredible results that challenges the Higgs boson formula by a factor of three ' +
    'according to a peer-reviewed study published in Nature. Scientists at CERN are reviewing the implications; ' +
    'Quantum Labs is mentioned only as a footnote sponsor with no product or funding claims in this article.';
  const r = evaluateStartupCorrelatePolicy({
    name: 'Quantum Labs',
    description: text,
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.checks.pure_academic, true);
  assert.strictEqual(r.reason, 'correlate/pure_academic_context');
});

test('reject: Google named NAME as head — exec hire, no deal narrative, no URL', () => {
  const text =
    'Google just named Priya Sundaram as head of robotics, which will use a new approach to inferencing, ' +
    'scraping their previous approach using legacy tooling at the Mountain View campus.';
  const r = evaluateStartupCorrelatePolicy({
    name: 'Priya Sundaram',
    description: text,
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.checks.exec_person_headline, true);
});

test('reject: name not present in description', () => {
  const r = evaluateStartupCorrelatePolicy({
    name: 'TotallyOtherCo',
    description: longDeal.replace(/Acme Data/g, 'OtherCo'),
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'correlate/name_not_in_description');
});

test('reject: thin context and no URL', () => {
  const r = evaluateStartupCorrelatePolicy({
    name: 'Zebra AI',
    description: 'Short.',
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'correlate/no_url_and_thin_context');
});

console.log('\nstartup-correlate-policy.test.js — all passed\n');
