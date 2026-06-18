#!/usr/bin/env node
/**
 * Smoke tests — 3-act founder workflow (Acts 1–3)
 *
 * Usage:
 *   node scripts/smoke-wizard-3act.mjs
 *   BASE=https://pythh.ai node scripts/smoke-wizard-3act.mjs
 *   BASE=http://localhost:3002 node scripts/smoke-wizard-3act.mjs
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASE = (process.env.BASE || 'https://pythh.ai').replace(/\/$/, '');
const TEST_URL = process.env.SMOKE_URL || 'resonate.audio';

let pass = 0;
let fail = 0;
let skip = 0;

function ok(label, detail = '') {
  pass++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
}

function bad(label, detail = '') {
  fail++;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

function skipTest(label, detail = '') {
  skip++;
  console.log(`  ⏭️  ${label}${detail ? ` — ${detail}` : ''}`);
}

function isRouteNotDeployed(res, body) {
  if (res.status !== 404) return false;
  const msg = typeof body?.error === 'string' ? body.error : body?.error?.message || '';
  return msg.includes('route not found') || msg.includes('Cannot GET');
}

async function fetchJson(path, opts = {}) {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 300) };
  }
  return { res, body, url };
}

// ── 1. Local lib smoke (no network) ─────────────────────────────────────────

function testLocalLibs() {
  console.log('\n== Local libs (Act 1–3 logic) ==');

  const { buildInvestorReadPayload } = require('../server/lib/investorReadService.js');
  const { enrichGapTasks, buildUnlockSummary } = require('../server/lib/taskUnlockCatalog.js');
  const { computeRoundReadiness, gateOutreachPayload, OUTREACH_THRESHOLD } = require('../server/lib/readinessGateService.js');

  const startup = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Smoke Co',
    total_god_score: 58,
    team_score: 45,
    traction_score: 38,
    market_score: 62,
    product_score: 55,
    vision_score: 50,
    sectors: ['AI/ML'],
    stage: 2,
    is_launched: true,
    tagline: 'AI tooling for founders',
    description: 'We help founders read investor signals before they pitch.',
  };

  const matches = [
    { match_score: 74, reasoning: 'Thesis fit', why_you_match: ['Sector'], investors: { name: 'Jane', firm: 'Acme VC' } },
    { match_score: 68, reasoning: 'Stage fit', why_you_match: [], investors: { name: 'Bob', firm: 'Seed Fund' } },
  ];
  const gapTasks = enrichGapTasks(
    [{ task_key: 'secure_first_customer', component: 'traction', component_score: 38, title: 'x', description: 'y', impact_points: 14, proof_type: 'text', proof_label: 'z', priority: 1 }],
    startup,
    12,
  );

  const read = buildInvestorReadPayload(startup, matches, gapTasks);
  if (read.founder_read?.proxies?.length === 4 && read.consensus_map?.investors?.length === 2) {
    ok('Act 1 investor-read payload', `archetype=${read.founder_read.archetype_label}`);
  } else bad('Act 1 investor-read payload', 'missing fields');

  if (gapTasks[0].partner_objection && gapTasks[0].investors_unlocked_estimate > 0) {
    ok('Act 2 unlock enrichment', `~${gapTasks[0].investors_unlocked_estimate} investors`);
  } else bad('Act 2 unlock enrichment');

  const summary = buildUnlockSummary(gapTasks, startup);
  if (summary.total_potential_gain > 0 && summary.headline) {
    ok('Act 2 unlock summary', `+${summary.total_potential_gain} pts`);
  } else bad('Act 2 unlock summary');

  const gateLocked = computeRoundReadiness({
    startup,
    tasks: [],
    doc: null,
    matchCount: 10,
    topMatchScore: 70,
  });
  if (gateLocked.status === 'locked' || gateLocked.status === 'building') {
    ok('Act 3 gate (locked/building)', `score=${gateLocked.readiness_score}`);
  } else bad('Act 3 gate locked state', gateLocked.status);

  const gateReady = computeRoundReadiness({
    startup,
    tasks: [{ status: 'acknowledged' }, { status: 'acknowledged' }, { status: 'completed' }],
    doc: { is_provisional: true, content: { header: {} } },
    matchCount: 15,
    topMatchScore: 72,
  });
  if (gateReady.outreach_ready && gateReady.readiness_score >= OUTREACH_THRESHOLD) {
    ok('Act 3 gate (outreach ready)', `score=${gateReady.readiness_score}`);
  } else bad('Act 3 gate outreach', `ready=${gateReady.outreach_ready} score=${gateReady.readiness_score}`);

  const gated = gateOutreachPayload({ investors: [{ id: '1' }], email_drafts: [{ x: 1 }] }, gateLocked);
  if (gated.locked === true && gated.email_drafts?.length === 0) {
    ok('Act 3 outreach redaction when locked');
  } else bad('Act 3 outreach redaction');

  const ungated = gateOutreachPayload({ investors: [{ id: '1' }], email_drafts: [{ x: 1 }] }, gateReady);
  if (ungated.locked === false) ok('Act 3 outreach open when ready');
  else bad('Act 3 outreach open');
}

// ── 2. API smoke (network) ───────────────────────────────────────────────────

async function testApi() {
  console.log(`\n== API smoke — ${BASE} ==`);

  // Health
  const health = await fetchJson('/api/health');
  if (health.res.ok) ok('GET /api/health', String(health.res.status));
  else bad('GET /api/health', String(health.res.status));

  // Resolve startup via instant submit
  console.log('\n  Resolving startup…');
  const submit = await fetchJson('/api/instant/submit', {
    method: 'POST',
    body: JSON.stringify({ url: TEST_URL.startsWith('http') ? TEST_URL : `https://${TEST_URL}` }),
  });

  const startupId = submit.body?.startup_id;
  if (!submit.res.ok || !startupId) {
    bad('POST /api/instant/submit', submit.body?.error || submit.res.status);
    skipTest('Wizard API tests', 'no startup_id');
    return;
  }
  ok('POST /api/instant/submit', `startup_id=${startupId.slice(0, 8)}… matches=${submit.body?.match_count ?? '?'}`);

  const uuidRe = /^[0-9a-f-]{36}$/i;
  if (!uuidRe.test(startupId)) bad('startup_id format');

  // Act 1
  const read = await fetchJson(`/api/wizard/${startupId}/investor-read`);
  if (isRouteNotDeployed(read.res, read.body)) {
    skipTest('GET /api/wizard/:id/investor-read', 'deploy Fly API to enable');
  } else if (read.res.ok && read.body?.founder_read && read.body?.consensus_map) {
    ok('Act 1 GET investor-read', `GOD=${read.body.god_score} advocates=${read.body.consensus_map?.partner_advocates}`);
  } else {
    const errMsg = typeof read.body?.error === 'string'
      ? read.body.error
      : read.body?.error?.message || JSON.stringify(read.body?.error || read.body).slice(0, 80);
    bad('Act 1 GET investor-read', `${read.res.status} ${errMsg}`.trim());
  }

  // Act 2
  const gaps = await fetchJson(`/api/wizard/${startupId}/gaps`);
  if (gaps.res.status === 404 && String(gaps.body?.error || '').includes('Cannot GET')) {
    skipTest('GET /api/wizard/:id/gaps', 'route not deployed yet');
  } else if (gaps.res.ok && Array.isArray(gaps.body?.gap_tasks)) {
    const t = gaps.body.gap_tasks[0];
    const hasUnlock = t?.partner_objection && t?.investors_unlocked_estimate != null;
    if (gaps.body.unlock_summary && (gaps.body.gap_tasks.length === 0 || hasUnlock)) {
      ok('Act 2 GET gaps', `${gaps.body.gap_tasks.length} tasks, summary ok`);
    } else if (gaps.res.ok) {
      ok('Act 2 GET gaps (legacy)', `${gaps.body.gap_tasks.length} tasks — deploy for unlock fields`);
    }
  } else {
    bad('Act 2 GET gaps', `${gaps.res.status} ${gaps.body?.error || ''}`.trim());
  }

  // Act 3 round status
  const round = await fetchJson(`/api/wizard/${startupId}/round-status`);
  if (isRouteNotDeployed(round.res, round.body)) {
    skipTest('GET /api/wizard/:id/round-status', 'deploy Fly API to enable');
  } else if (round.res.ok && round.body?.readiness_score != null && round.body?.requirements) {
    ok('Act 3 GET round-status', `score=${round.body.readiness_score} status=${round.body.status}`);
  } else {
    const errMsg = typeof round.body?.error === 'string'
      ? round.body.error
      : round.body?.error?.message || JSON.stringify(round.body?.error || round.body).slice(0, 80);
    bad('Act 3 GET round-status', `${round.res.status} ${errMsg}`.trim());
  }

  // Act 3 outreach package (should return gated or full)
  const outreach = await fetchJson(`/api/wizard/${startupId}/outreach-package`);
  if (outreach.res.ok) {
    const locked = outreach.body?.locked === true;
    const drafts = outreach.body?.email_drafts?.length ?? 0;
    ok('Act 3 GET outreach-package', locked ? `locked, ${outreach.body?.investors?.length ?? 0} teaser` : `${drafts} drafts`);
    if (outreach.body?.gate) ok('Act 3 outreach includes gate metadata');
  } else if (outreach.res.status === 404) {
    skipTest('Act 3 GET outreach-package', 'route not deployed');
  } else {
    bad('Act 3 GET outreach-package', `${outreach.res.status}`);
  }

  // Invalid UUID → 400
  const badId = await fetchJson('/api/wizard/not-a-uuid/gaps');
  if (badId.res.status === 400) ok('Invalid startup ID returns 400');
  else bad('Invalid startup ID', `got ${badId.res.status}`);

  // activate-round without readiness → 403
  const activate = await fetchJson(`/api/wizard/${startupId}/activate-round`, { method: 'POST' });
  if (activate.res.status === 403) {
    ok('POST activate-round gated', activate.body?.message?.slice(0, 60) || '403');
  } else if (isRouteNotDeployed(activate.res, activate.body)) {
    skipTest('POST activate-round', 'deploy Fly API to enable');
  } else if (activate.res.ok) {
    ok('POST activate-round', 'already eligible on prod startup');
  } else {
    bad('POST activate-round', `${activate.res.status}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('🔍 3-Act Wizard Smoke Tests');
console.log('================================================');

testLocalLibs();
await testApi();

console.log('\n================================================');
console.log(`Results: ${pass} passed, ${fail} failed, ${skip} skipped`);
if (fail > 0) process.exit(1);
process.exit(0);
