import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  isCleanStartupNameForFeed,
  isPublicFeedStartup,
  isPublicFeedMatchScore,
} = require('../server/lib/feedNameGuards.js');

test('public live feed drops headline fragments without a qualified website', () => {
  assert.equal(isCleanStartupNameForFeed('Declining'), true);
  assert.equal(isPublicFeedStartup({
    name: 'Declining',
    website: null,
    entityGate: null,
    status: 'approved',
  }), false);
  assert.equal(isPublicFeedStartup({
    name: 'Postgres Not',
    website: null,
    entityGate: null,
    status: 'approved',
  }), false);
  assert.equal(isPublicFeedStartup({
    name: 'One Key Short',
    website: null,
    entityGate: null,
    status: 'approved',
  }), false);
  assert.equal(isPublicFeedStartup({
    name: 'Kim Greist',
    website: null,
    entityGate: null,
    status: 'approved',
  }), false);
  assert.equal(isPublicFeedMatchScore(40), false);
  assert.equal(isPublicFeedMatchScore(50), true);
});

test('public live feed keeps a qualified startup with a real site', () => {
  assert.equal(isPublicFeedStartup({
    name: 'Scotch',
    website: 'https://scotch.ai',
    entityGate: 'qualified',
    status: 'approved',
  }), true);
  assert.equal(isPublicFeedStartup({
    name: 'AssetPlus',
    website: 'https://assetplus.io',
    entityGate: 'qualified',
    status: 'approved',
  }), true);
});
