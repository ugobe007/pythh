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

test('Intent routing engine correctly maps canonical founder and investor queries', () => {
  const { classifyUserQueryIntent } = require('../server/routes/gptActions');

  // Phrase 1: "find investors for my startup"
  const r1 = classifyUserQueryIntent('find investors for my startup');
  assert.equal(r1.intent, 'match_investors');
  assert.equal(r1.target_operation, 'findActiveVcMatches');
  assert.equal(r1.extracted_slots.stage, 'Seed');

  // Phrase 2: "find AI investors"
  const r2 = classifyUserQueryIntent('find AI investors');
  assert.equal(r2.intent, 'match_investors');
  assert.equal(r2.target_operation, 'findActiveVcMatches');
  assert.equal(r2.extracted_slots.sector, 'AI');

  // Phrase 3: "who are the best-fit VCs?"
  const r3 = classifyUserQueryIntent('who are the best-fit VCs?');
  assert.equal(r3.intent, 'match_investors');
  assert.equal(r3.target_operation, 'findActiveVcMatches');

  // Phrase 4: "who co-invests with Founders Fund?"
  const r4 = classifyUserQueryIntent('who co-invests with Founders Fund?');
  assert.equal(r4.intent, 'map_syndicates');
  assert.equal(r4.target_operation, 'mapVcSyndicates');
  assert.equal(r4.extracted_slots.firm_name, 'Founders Fund');

  // Phrase 5: "is Sequoia Capital actively writing seed checks?"
  const r5 = classifyUserQueryIntent('is Sequoia Capital actively writing seed checks?');
  assert.equal(r5.intent, 'verify_thesis');
  assert.equal(r5.target_operation, 'verifyVcThesis');
  assert.equal(r5.extracted_slots.name, 'Sequoia Capital');

  // Phrase 6: "audit my startup pitch: B2B SaaS with $350k in ARR raising $2M seed"
  const r6 = classifyUserQueryIntent('audit my startup pitch: B2B SaaS with $350k in ARR raising $2M seed');
  assert.equal(r6.intent, 'audit_god_score');
  assert.equal(r6.target_operation, 'auditStartupGodScore');
  assert.equal(r6.extracted_slots.arr_usd, 350000);
  assert.equal(r6.extracted_slots.target_raise_usd, 2000000);
  assert.equal(r6.extracted_slots.stage, 'Seed');

  // Phrase 7: "what are the latest venture funding rounds today?"
  const r7 = classifyUserQueryIntent('what are the latest venture funding rounds today?');
  assert.equal(r7.intent, 'daily_signal');
  assert.equal(r7.target_operation, 'getDailySignalRadar');
});
