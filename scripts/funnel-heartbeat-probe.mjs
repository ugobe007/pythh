#!/usr/bin/env node
/**
 * Synthetic funnel probe — exercises live pythh.ai stages and verifies ai_logs / growth events.
 *
 * Usage:
 *   npm run funnel:heartbeat
 *   BASE=https://pythh.ai npm run funnel:heartbeat
 *   npm run funnel:heartbeat -- --no-fail   # report only (for agent preflight)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { verifyProbeRun } = require('../server/lib/funnelTelemetry.js');

const NO_FAIL = process.argv.includes('--no-fail');
const BASE = (process.env.BASE || 'https://pythh.ai').replace(/\/$/, '');
const TEST_URL = process.env.SMOKE_URL || 'stripe.com';
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(repoRoot, 'reports');

const probeRunId = crypto.randomUUID();
const anonId = `probe-${probeRunId.slice(0, 8)}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(route, opts = {}) {
  const url = `${BASE}${route.startsWith('/') ? route : `/${route}`}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-probe-run-id': probeRunId,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 200) };
  }
  return { res, body, url };
}

async function runProbe() {
  const steps = [];
  const url = TEST_URL.startsWith('http') ? TEST_URL : `https://${TEST_URL}`;

  // 1. page_view (client-style analytics)
  {
    const { res } = await fetchJson('/api/analytics/flush', {
      method: 'POST',
      body: JSON.stringify({
        rows: [
          {
            operation: 'page_view',
            status: 'tracked',
            output: { path: '/matches', probe_run_id: probeRunId, source: 'funnel_probe' },
          },
        ],
      }),
    });
    steps.push({ step: 'page_view', ok: res.ok, status: res.status });
  }

  // 2. instant submit → server logs url_submitted + preview_requested
  let startupId = null;
  let investorId = null;
  {
    const { res, body } = await fetchJson('/api/instant/submit', {
      method: 'POST',
      body: JSON.stringify({
        url,
        source: 'funnel_probe',
        probe_run_id: probeRunId,
      }),
    });
    startupId = body?.startup_id || body?.id;
    steps.push({
      step: 'instant_submit',
      ok: res.ok || res.status === 202,
      status: res.status,
      startup_id: startupId,
      match_count: body?.match_count,
    });
  }

  if (!startupId) {
    return {
      probe_run_id: probeRunId,
      base: BASE,
      steps,
      error: 'instant_submit did not return startup_id',
      diagnosis: 'probe_failed',
    };
  }

  // 3. preview API
  {
    const { res, body } = await fetchJson(
      `/api/preview/${startupId}?probe_run_id=${probeRunId}&source=funnel_probe`,
    );
    const match = body?.matches?.[0];
    investorId = match?.investor_id || match?.investor?.id;
    steps.push({
      step: 'preview_api',
      ok: res.ok,
      status: res.status,
      matches: body?.matches?.length ?? 0,
    });
  }

  // 4. instant_matches_viewed
  {
    const { res } = await fetchJson('/api/analytics/flush', {
      method: 'POST',
      body: JSON.stringify({
        rows: [
          {
            operation: 'instant_matches_viewed',
            status: 'tracked',
            output: {
              startup_id: startupId,
              url,
              probe_run_id: probeRunId,
              source: 'funnel_probe',
            },
          },
        ],
      }),
    });
    steps.push({ step: 'instant_matches_viewed', ok: res.ok, status: res.status });
  }

  // 5. match engage (view)
  if (investorId) {
    const { res, body } = await fetchJson('/api/matches/engage', {
      method: 'POST',
      body: JSON.stringify({
        startup_id: startupId,
        investor_id: investorId,
        action: 'view',
        source: 'funnel_probe',
        probe_run_id: probeRunId,
      }),
    });
    steps.push({ step: 'match_engage_view', ok: res.ok, status: res.status, detail: body?.error });
  } else {
    steps.push({ step: 'match_engage_view', ok: false, skipped: true, detail: 'no investor in preview' });
  }

  // 6. investor signup started (growth experiment)
  {
    let experimentId = 'investor_signup_schema';
    let variantKey = 'short_form';
    const assign = await fetchJson(
      `/api/growth/assign?audience=investor&anon_id=${encodeURIComponent(anonId)}`,
    );
    if (assign.res.ok && assign.body?.assignment) {
      experimentId = assign.body.assignment.experiment_id || experimentId;
      variantKey = assign.body.assignment.variant_key || variantKey;
    }

    const { res } = await fetchJson('/api/growth/event', {
      method: 'POST',
      body: JSON.stringify({
        experiment_id: experimentId,
        variant_key: variantKey,
        audience: 'investor',
        event_name: 'investor_signup_started',
        anon_id: anonId,
        payload: { probe_run_id: probeRunId, source: 'funnel_probe' },
      }),
    });
    steps.push({ step: 'investor_signup_started', ok: res.ok, status: res.status });
  }

  // 7. founder signup started (preview gate — matches_preview variant)
  {
    let experimentId = 'founder_hero_entry';
    let variantKey = 'matches_preview';
    const assign = await fetchJson(
      `/api/growth/assign?audience=founder&anon_id=${encodeURIComponent(anonId)}`,
    );
    if (assign.res.ok && assign.body?.assignment) {
      experimentId = assign.body.assignment.experiment_id || experimentId;
      variantKey = assign.body.assignment.variant_key || variantKey;
    }

    const { res } = await fetchJson('/api/growth/event', {
      method: 'POST',
      body: JSON.stringify({
        experiment_id: experimentId,
        variant_key: variantKey,
        audience: 'founder',
        event_name: 'founder_signup_started',
        anon_id: anonId,
        payload: {
          probe_run_id: probeRunId,
          source: 'funnel_probe',
          gated_action: 'save',
          startup_id: startupId,
        },
      }),
    });
    steps.push({ step: 'founder_signup_started', ok: res.ok, status: res.status });
  }

  await sleep(3500);

  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const verification = await verifyProbeRun(sb, probeRunId);

  return {
    generated_at: new Date().toISOString(),
    probe_run_id: probeRunId,
    base: BASE,
    test_url: url,
    steps,
    verification,
    diagnosis: verification.diagnosis,
    ok: verification.required_stages_ok && verification.stages_logged >= 4,
  };
}

async function main() {
  fs.mkdirSync(reportsDir, { recursive: true });
  console.log(`\n💓 Funnel heartbeat probe → ${BASE}`);
  console.log(`   probe_run_id=${probeRunId}\n`);

  const report = await runProbe();
  const outFile = path.join(reportsDir, `funnel-heartbeat-${report.generated_at?.slice(0, 10) || 'run'}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  if (report.verification) {
    console.log('   Stage verification:');
    for (const s of report.verification.stages) {
      console.log(`     ${s.logged ? '✅' : '❌'} ${s.id}${s.count ? ` (${s.count})` : ''}`);
    }
    console.log(`\n   Diagnosis: ${report.diagnosis}`);
    console.log(`   Required stages OK: ${report.verification.required_stages_ok}`);
  } else {
    console.log(`   ❌ Probe error: ${report.error}`);
  }

  console.log(`\n📁 ${outFile}\n`);

  if (!report.ok && !NO_FAIL) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
