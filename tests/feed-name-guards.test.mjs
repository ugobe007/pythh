import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isCleanStartupNameForFeed,
  isPublicFeedStartup,
} = require('../server/lib/feedNameGuards.js');

test('public feed rejects trajectory labels and bracketed scrapes', () => {
  assert.equal(isCleanStartupNameForFeed('Declining'), false);
  assert.equal(isCleanStartupNameForFeed('[declining]'), false);
  assert.equal(isCleanStartupNameForFeed('(Rising)'), false);
  assert.equal(isCleanStartupNameForFeed('Anytime'), false);
  assert.equal(isCleanStartupNameForFeed('Postgres Not'), false);
  assert.equal(isCleanStartupNameForFeed('July Cuban'), false);
  assert.equal(isCleanStartupNameForFeed('TowerBrook'), false);
  assert.equal(isCleanStartupNameForFeed('XMRig'), false);
  assert.equal(isCleanStartupNameForFeed('Lianyungang'), false);
});

test('public feed keeps plausible company names', () => {
  assert.equal(isCleanStartupNameForFeed('Stripe'), true);
  assert.equal(isCleanStartupNameForFeed('GlassClaw AI'), true);
  assert.equal(isCleanStartupNameForFeed('BrightLocal'), true);
  assert.equal(isCleanStartupNameForFeed('AssetPlus'), true);
  assert.equal(isCleanStartupNameForFeed('Scotch'), true);
});

test('homepage feed requires a qualified startup with a real website', () => {
  assert.equal(isPublicFeedStartup({
    name: 'Declining',
    status: 'approved',
    entity_gate: null,
    website: null,
  }), false);
  assert.equal(isPublicFeedStartup({
    name: 'Stripe',
    status: 'approved',
    entity_gate: 'qualified',
    website: '',
  }), false);
  assert.equal(isPublicFeedStartup({
    name: 'Stripe',
    status: 'approved',
    entity_gate: 'qualified',
    website: 'https://techcrunch.com/2024/01/01/stripe-raises',
  }), false);
  assert.equal(isPublicFeedStartup({
    name: 'Stripe',
    status: 'approved',
    entity_gate: 'qualified',
    website: 'https://stripe.com',
  }), true);
});
