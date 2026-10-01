'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getOpenApiSpec } = require('../server/routes/gptActions');
const { calculateGodScoreBreakdownFromStartup } = require('../server/scoring/hotGodFromStartupRow');

test('OpenAPI spec contains all 5 ChatGPT wedge action routes', () => {
  const spec = getOpenApiSpec();
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.info.title.includes('Pythh'));
  
  const paths = Object.keys(spec.paths);
  assert.ok(paths.includes('/api/actions/vc-matches'));
  assert.ok(paths.includes('/api/actions/god-score'));
  assert.ok(paths.includes('/api/actions/syndicates'));
  assert.ok(paths.includes('/api/actions/vc-thesis'));
  assert.ok(paths.includes('/api/actions/daily-signal'));

  // Ensure operationIds and descriptions are tuned for natural language matching
  assert.equal(spec.paths['/api/actions/vc-matches'].get.operationId, 'findActiveVcMatches');
  assert.equal(spec.paths['/api/actions/god-score'].post.operationId, 'auditStartupGodScore');
  assert.equal(spec.paths['/api/actions/syndicates'].get.operationId, 'mapVcSyndicates');
  assert.equal(spec.paths['/api/actions/vc-thesis'].get.operationId, 'verifyVcThesis');
  assert.equal(spec.paths['/api/actions/daily-signal'].get.operationId, 'getDailySignalRadar');
});

test('OpenAPI spec supports targeted single-wedge filtering for dedicated GPTs', () => {
  const godSpec = getOpenApiSpec('god-score');
  assert.equal(Object.keys(godSpec.paths).length, 1);
  assert.ok(godSpec.paths['/api/actions/god-score']);

  const vcSpec = getOpenApiSpec('vc-matches');
  assert.equal(Object.keys(vcSpec.paths).length, 1);
  assert.ok(vcSpec.paths['/api/actions/vc-matches']);
});

test('GOD score calculation evaluates startup metrics across 5 pillars', () => {
  const mockStartup = {
    name: 'NeuralFlow',
    website: 'neuralflow.ai',
    stage: 'Seed',
    annual_revenue: 350000,
    elevator_pitch: 'Autonomous workflow optimization for enterprise logistics',
    team_description: 'Ex-Google Brain, Stanford CS PhDs',
    status: 'active',
  };

  const breakdown = calculateGodScoreBreakdownFromStartup(mockStartup);
  assert.ok(Number.isFinite(breakdown.total_god_score));
  assert.ok(breakdown.total_god_score > 0 && breakdown.total_god_score <= 100);
  assert.ok(Number.isFinite(breakdown.team_score));
  assert.ok(Number.isFinite(breakdown.traction_score));
  assert.ok(Number.isFinite(breakdown.market_score));
  assert.ok(Number.isFinite(breakdown.product_score));
  assert.ok(Number.isFinite(breakdown.vision_score));
});

test('Syndicate networks identify tier-1 lead firms correctly', () => {
  const { isWellKnownFirm } = require('../lib/fundingAttentionPatterns.mjs');
  assert.equal(isWellKnownFirm({ firm: 'Sequoia Capital' }), true);
  assert.equal(isWellKnownFirm({ firm: 'Founders Fund' }), true);
  assert.equal(isWellKnownFirm({ firm: 'Andreessen Horowitz' }), true);
  assert.equal(isWellKnownFirm({ firm: 'Random Undisclosed Fund XYZ' }), false);
});
