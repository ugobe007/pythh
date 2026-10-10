/**
 * Sector extraction: word-boundary keywords + robotics conflict rules.
 * Run: node --test tests/sector-extraction-robotics.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  extractSectors,
  inferSectorsFromIdentity,
  reconcileSectors,
  resolveStartupSectors,
} = require('../lib/inference-extractor.js');

const ALPHA_URL = 'https://alpharoboticsai.com';
const ALPHA_NAME = 'Alpharoboticsai';
const ALPHA_TEXT = `
Building the business infrastructure for Physical AI.
Healthcare Robots Service Robots Manufacturing Auto Hospitality Robots Security Robotics.
How do we train our teams — and finance the investment?
What payment methods do you accept? We accept major credit and debit cards.
Milestone-based delivery, documented acceptance, and defined warranty responsibility.
Explore Our Marketplace. Industrial Robotics Logistics & Warehouse AI Robotics Systems.
`;

test('extractSectors ranks Robotics over substring false positives', () => {
  const sectors = extractSectors(ALPHA_TEXT);
  assert.ok(sectors.includes('Robotics'), `expected Robotics, got ${sectors}`);
  assert.equal(sectors[0], 'Robotics', `Robotics should rank first: ${sectors}`);
  // payment / defined / hospitality must not invent FinTech via substrings;
  // weak "payment methods" FAQ may still keyword-hit — conflict rules strip it.
  assert.ok(
    !sectors.includes('FinTech') || sectors.indexOf('Robotics') < sectors.indexOf('FinTech'),
    `FinTech should not outrank Robotics: ${sectors}`,
  );
});

test('alpharoboticsai resolves to Robotics-led sectors without FinTech/HealthTech', () => {
  const identity = inferSectorsFromIdentity(ALPHA_URL, ALPHA_NAME, ALPHA_TEXT);
  assert.deepEqual(identity.filter((s) => s === 'HealthTech'), []);
  assert.ok(identity.includes('Robotics'));

  const resolved = resolveStartupSectors({
    url: ALPHA_URL,
    name: ALPHA_NAME,
    text: ALPHA_TEXT,
    inferenceSectors: extractSectors(ALPHA_TEXT),
    storedSectors: ['Robotics', 'HealthTech', 'FinTech'],
  });
  assert.ok(resolved.includes('Robotics'), resolved);
  assert.ok(!resolved.includes('FinTech'), `unexpected FinTech: ${resolved}`);
  assert.ok(!resolved.includes('HealthTech'), `unexpected HealthTech: ${resolved}`);
});

test('reconcile keeps HealthTech when company is actually healthcare', () => {
  const text = 'We build clinical diagnostics software for hospital patient care and telemedicine.';
  const resolved = resolveStartupSectors({
    url: 'https://clinicly.health',
    name: 'Clinicly',
    text,
    inferenceSectors: extractSectors(text),
  });
  assert.ok(resolved.includes('HealthTech'), resolved);
});

test('reconcile keeps FinTech for real fintech identity', () => {
  const text = 'Neobank fintech platform for small business banking and lending.';
  const resolved = resolveStartupSectors({
    url: 'https://payneobank.com',
    name: 'PayNeobank',
    text,
    inferenceSectors: extractSectors(text),
  });
  assert.ok(resolved.includes('FinTech'), resolved);
});
