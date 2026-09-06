import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import {
  DEFAULT_YC_BATCH,
  YC_OSS_BATCH_URL,
  batchToSlug,
  buildYcWhoTitle,
  decideStartupAttach,
  namesCompatible,
  normalizeHost,
  sourceEventKey,
} from '../lib/ycBatchWho.mjs';
import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { classifyFundingEvidence } = loadFundingEvidenceLedger();

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('Spring 2026 slug and source keys stay stable', () => {
  assert.equal(batchToSlug(DEFAULT_YC_BATCH), 'spring-2026');
  assert.equal(YC_OSS_BATCH_URL('spring-2026'), 'https://yc-oss.github.io/api/batches/spring-2026.json');
  assert.equal(sourceEventKey('Spring 2026', 'Autostep'), 'yc-batch:spring-2026:autostep');
});

test('website host matching rejects name-only collisions', () => {
  assert.equal(normalizeHost('https://www.askjo.ai/'), 'askjo.ai');
  assert.equal(namesCompatible('jo', 'jo'), true);
  assert.equal(namesCompatible('Jo (askjo.ai)', 'jo'), true);
  assert.equal(namesCompatible('Jo', 'Another Jo'), false);

  assert.equal(decideStartupAttach({
    companyHost: 'askjo.ai',
    companyName: 'jo',
    existing: { id: '1', name: 'Jo', website: 'https://otherjo.com' },
  }).action, 'skip');

  assert.deepEqual(decideStartupAttach({
    companyHost: 'askjo.ai',
    companyName: 'jo',
    existing: { id: '1', name: 'Jo', website: 'https://askjo.ai' },
  }), { action: 'reuse', startupId: '1' });

  assert.equal(decideStartupAttach({
    companyHost: 'askjo.ai',
    companyName: 'jo',
    existing: { id: '2', name: 'Unrelated', website: 'https://askjo.ai' },
  }).reason, 'website_taken_other_name');

  assert.equal(decideStartupAttach({ companyHost: 'autostep.ai', companyName: 'Autostep' }).action, 'create');
});

test('YC who titles are classifier-eligible and not join-only headlines', () => {
  const title = buildYcWhoTitle('Autostep', 'Spring 2026');
  assert.equal(title, 'Autostep is backed by Y Combinator (Spring 2026)');
  const classified = classifyFundingEvidence({
    event_type: 'FUNDING',
    source_title: title,
    frame_confidence: 1,
    extraction_meta: { decision: 'ACCEPT', graph_safe: true },
  });
  assert.equal(classified.eligible, true);
  const joinOnly = classifyFundingEvidence({
    event_type: 'FUNDING',
    source_title: 'Autostep joins Y Combinator Spring 2026',
    frame_confidence: 1,
    extraction_meta: { decision: 'ACCEPT', graph_safe: true },
  });
  assert.equal(joinOnly.eligible, false);
});

test('YC batch who script stays observed-only and does not write thesis or ingest-audited rows', () => {
  const script = read('../scripts/seed-yc-batch-who.mjs');
  const ingest = read('../scripts/ingest-audited-funding-events.mjs');
  assert.match(script, /verification_status: 'observed'/);
  assert.match(script, /participant_list_complete: false/);
  assert.match(script, /hit5_claim_ready: false/);
  assert.match(script, /Y Combinator/);
  assert.match(script, /website host only/);
  assert.doesNotMatch(script, /verification_status: 'verified'/);
  assert.doesNotMatch(script, /investment_thesis:/);
  assert.doesNotMatch(script, /freezeTopFiveIfAbsent/);
  assert.match(script, /add YC to frequentLedgerFunders/);
  assert.match(ingest, /Do NOT ingest YC Spring 2026/);
  assert.doesNotMatch(ingest, /audited:yc-spring-2026:/);
});
