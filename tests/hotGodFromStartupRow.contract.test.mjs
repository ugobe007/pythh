/**
 * Contract tests for server/scoring/hotGodFromStartupRow.js
 * (shared with scripts/recalculate-scores.ts, instant submit, deck upload).
 */
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const hotGod = require(join(__dirname, '../server/scoring/hotGodFromStartupRow.js'));

test('calculateGodScoreColumnsFromStartup returns stable column contract', () => {
  const golden = {
    id: '00000000-0000-4000-8000-000000000001',
    tagline: 'Contract test startup',
    description: 'Enterprise AI workflow automation with measurable ROI.',
    sectors: ['AI/ML', 'Enterprise'],
    stage: 'seed',
    team_size: 2,
    traction_confidence: 0.36,
    arr_usd: 500_000,
    parsed_customers: 12,
    funding_confidence: 0.36,
    last_round_amount_usd: 2_000_000,
    extracted_data: {
      has_revenue: false,
      pitch: 'Backup pitch from extracted_data.',
    },
  };
  const cols = hotGod.calculateGodScoreColumnsFromStartup(golden);
  for (const k of [
    'team_score',
    'traction_score',
    'market_score',
    'product_score',
    'vision_score',
    'total_god_score',
  ]) {
    assert.strictEqual(typeof cols[k], 'number', k);
    assert.ok(!Number.isNaN(cols[k]), `${k} is NaN`);
    assert.ok(cols[k] >= 0 && cols[k] <= 100, `${k} out of range: ${cols[k]}`);
  }
});

test('calculateGodScoreBreakdownFromStartup includes psych-compatible fields', () => {
  const golden = { tagline: 'Minimal row', extracted_data: {} };
  const full = hotGod.calculateGodScoreBreakdownFromStartup(golden);
  assert.ok('psychological_multiplier' in full);
  assert.ok(full.psychological_signals && typeof full.psychological_signals === 'object');
  assert.strictEqual(typeof full.enhanced_god_score, 'number');
});

test('traction_confidence >= 0.35 uses parsed ARR as primary revenue input', () => {
  const row = {
    tagline: 'Parsed ARR test',
    description: 'We sell software.',
    traction_confidence: 0.35,
    arr_usd: 1_000_000,
    extracted_data: {},
  };
  const p = hotGod.toScoringProfileFromStartupUpload(row);
  assert.strictEqual(p.revenue, 1_000_000);
});
