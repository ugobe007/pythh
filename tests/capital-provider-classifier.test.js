'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyCapitalProvider,
  providerTypeToInvestorType,
  looksLikePersonName,
} = require('../lib/capitalProviderClassifier');

test('Spectrum Impact Family Office → family_office', () => {
  const r = classifyCapitalProvider('Spectrum Impact Family Office');
  assert.equal(r.provider_type, 'family_office');
  assert.ok(r.confidence >= 0.9);
  assert.equal(providerTypeToInvestorType(r.provider_type), 'Family Office');
});

test('phrase context can classify FO even without FO in firm name', () => {
  const r = classifyCapitalProvider(
    'Spectrum Impact',
    'with participation from Spectrum Impact, a multi-family office',
  );
  assert.equal(r.provider_type, 'family_office');
});

test('co-mentioned firm is NOT FO just because phrase mentions family offices', () => {
  const r = classifyCapitalProvider(
    'PixelSky Capital',
    'led by PixelSky Capital, with participation from the Spectrum Impact Family Office and other investors.',
  );
  assert.equal(r.provider_type, 'vc');
});

test('Gruhas not FO when only co-listed with family offices', () => {
  const r = classifyCapitalProvider(
    'Gruhas',
    'from the likes of Lumis Partners, Rainmatter, Gruhas, KOIS Invest and several prominent family offices.',
  );
  assert.notEqual(r.provider_type, 'family_office');
});

test('YL Ventures → vc', () => {
  const r = classifyCapitalProvider('YL Ventures');
  assert.equal(r.provider_type, 'vc');
  assert.equal(r.suggested_investor_type, 'VC');
});

test('person-shaped name → angel', () => {
  assert.equal(looksLikePersonName('Zach Abrams'), true);
  const r = classifyCapitalProvider('Zach Abrams');
  assert.equal(r.provider_type, 'angel');
});

test('Oman wealth fund → sovereign', () => {
  const r = classifyCapitalProvider('Oman wealth fund');
  assert.equal(r.provider_type, 'sovereign');
});

test('SoftBank Vision Fund phrase with PE language stays institutional', () => {
  const r = classifyCapitalProvider('Jeito Capital', 'led by Jeito Capital');
  assert.equal(r.provider_type, 'vc');
});

test('strategic corporate without VC suffix', () => {
  const r = classifyCapitalProvider(
    'Zebra Technologies',
    'Secures Strategic Investment From Zebra Technologies',
  );
  assert.ok(['strategic', 'cvc'].includes(r.provider_type));
});
