import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { instrumentMatchOutcomes, instrumentMatchOutcomesSafe } = require('../server/lib/instrumentMatchOutcomes.js');

test('instrumentMatchOutcomes exports awaitable helpers', () => {
  assert.equal(typeof instrumentMatchOutcomes, 'function');
  assert.equal(typeof instrumentMatchOutcomesSafe, 'function');
});

test('instantSubmit instruments sync, phase1, phase3 skip, and timeouts', () => {
  const instant = readFileSync(new URL('../server/routes/instantSubmit.js', import.meta.url), 'utf8');
  assert.match(instant, /instrumentMatchOutcomesSafe/);
  assert.match(instant, /instant_sync/);
  assert.match(instant, /instant_bg_phase1/);
  assert.match(instant, /instant_bg_phase3_skipped/);
  assert.match(instant, /instant_bg_pre_phase3_timeout/);
  assert.doesNotMatch(
    instant,
    /enqueueFundingEvidenceSearchAsync\(supabase, startupId, \{ source: 'instant_bg_phase3'/,
  );
  assert.match(instant, /entity_gate: 'qualified'/);
  assert.match(instant, /company_domain: domain/);
});

test('match worker and enhanced matching await instrumentMatchOutcomesSafe', () => {
  const worker = readFileSync(new URL('../server/matchWorker.ts', import.meta.url), 'utf8');
  assert.match(worker, /instrumentMatchOutcomesSafe/);
  const enhanced = readFileSync(new URL('../server/services/EnhancedMatchingService.js', import.meta.url), 'utf8');
  assert.match(enhanced, /instrumentMatchOutcomesSafe/);
});

test('proof-cohort backfill script sets gate and freezes', () => {
  const backfill = readFileSync(new URL('../scripts/instrument-proof-cohort.mjs', import.meta.url), 'utf8');
  assert.match(backfill, /proof_cohort_backfill/);
  assert.match(backfill, /entity_gate: 'qualified'/);
  assert.match(backfill, /instrumentMatchOutcomes/);
});

test('triage no longer parks null entity_gate URL+website rows', () => {
  const triage = readFileSync(new URL('../scripts/triage-funding-evidence-queue.mjs', import.meta.url), 'utf8');
  assert.match(triage, /entity_gate = 'qualified' OR s\.entity_gate IS NULL/);
  assert.doesNotMatch(
    triage,
    /OR s\.entity_gate IS NULL\n\s+OR s\.source_type IS DISTINCT FROM 'url'/,
  );
});
