#!/usr/bin/env node
/**
 * Submit gateway contract — same URL via discovery vs instant must resolve to one startup_id.
 *
 * Usage:
 *   npm run contract:submit -- https://stripe.com
 *   PYTHH_CONTRACT_API_BASE=http://127.0.0.1:3002 node scripts/pythh-submit-gateway-contract.js stripe.com
 *
 * Flags:
 *   --reverse        Call /api/instant/submit first, then /api/discovery/submit (order sensitivity).
 *   --poll-results   After discovery, poll GET /api/discovery/results a few times (informational).
 *   --allow-mismatch Exit 0 even if startup_id differs (prints FAIL for CI logs only).
 *
 * Exit codes:
 *   0 = same startup_id (or --allow-mismatch)
 *   1 = HTTP/body failure, or mismatch without --allow-mismatch
 *   2 = bad usage (missing URL)
 *   3 = inconclusive (e.g. instant returned 202 without startup_id)
 *
 * Env: PYTHH_CONTRACT_API_BASE (default http://127.0.0.1:3002), PYTHH_CONTRACT_TEST_URL
 * Optional for mismatch diagnostics: SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_BASE = 'http://127.0.0.1:3002';
/** Must match server/routes/discoverySubmit.js DISCOVERY_SUBMIT_BUILD */
const EXPECTED_DISCOVERY_BUILD = 'discoverySubmit-v2.2';
const DISCOVERY_TIMEOUT_MS = Number(process.env.PYTHH_CONTRACT_DISCOVERY_MS || 120000);
const INSTANT_TIMEOUT_MS = Number(process.env.PYTHH_CONTRACT_INSTANT_MS || 170000);

function parseArgs(argv) {
  let reverse = false;
  let pollResults = false;
  let allowMismatch = false;
  const rest = [];
  for (const a of argv) {
    if (a === '--reverse') reverse = true;
    else if (a === '--poll-results') pollResults = true;
    else if (a === '--allow-mismatch') allowMismatch = true;
    else if (a.startsWith('--')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    } else rest.push(a);
  }
  const testUrl = rest[0] || process.env.PYTHH_CONTRACT_TEST_URL;
  return { reverse, pollResults, allowMismatch, testUrl };
}

async function fetchJson(method, url, opts = {}) {
  const { body, timeoutMs = 30000 } = opts;
  const init = {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : {},
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body != null) init.body = JSON.stringify(body);
  const r = await fetch(url, init);
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    /* raw */
  }
  return { ok: r.ok, status: r.status, json, text };
}

async function discoveryBuildProbe(base) {
  return fetchJson('GET', `${base.replace(/\/$/, '')}/api/discovery/__submit_build`, { timeoutMs: 8000 });
}

async function discoverySubmit(base, url) {
  return fetchJson('POST', `${base.replace(/\/$/, '')}/api/discovery/submit`, {
    body: { url },
    timeoutMs: DISCOVERY_TIMEOUT_MS,
  });
}

async function instantSubmit(base, url) {
  return fetchJson('POST', `${base.replace(/\/$/, '')}/api/instant/submit`, {
    body: { url },
    timeoutMs: INSTANT_TIMEOUT_MS,
  });
}

async function discoveryResults(base, jobId) {
  const q = encodeURIComponent(jobId);
  return fetchJson(
    'GET',
    `${base.replace(/\/$/, '')}/api/discovery/results?job_id=${q}`,
    { timeoutMs: 30000 }
  );
}

async function instantHealth(base) {
  return fetchJson('GET', `${base.replace(/\/$/, '')}/api/instant/health`, { timeoutMs: 8000 });
}

async function explainMismatch(idA, idB) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.error('  (Set SUPABASE_URL + SUPABASE_SERVICE_KEY to print row details on mismatch.)');
    return;
  }
  try {
    const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    const [{ data: ra }, { data: rb }] = await Promise.all([
      supabase.from('startup_uploads').select('id, name, website, status').eq('id', idA).maybeSingle(),
      supabase.from('startup_uploads').select('id, name, website, status').eq('id', idB).maybeSingle(),
    ]);
    console.error('  startup_uploads A:', ra);
    console.error('  startup_uploads B:', rb);
  } catch (e) {
    console.error('  (Supabase lookup failed)', e.message);
  }
}

function summarizeInstant(res) {
  if (!res.json || typeof res.json !== 'object') return {};
  return {
    status: res.status,
    startup_id: res.json.startup_id,
    match_count: res.json.match_count,
    is_new: res.json.is_new,
    cached: res.json.cached,
    gen_in_progress: res.json.gen_in_progress,
  };
}

function summarizeDiscovery(res) {
  if (!res.json || typeof res.json !== 'object') return {};
  return {
    status: res.status,
    startup_id: res.json.startup_id,
    job_id: res.json.job_id,
    job_status: res.json.status,
    message: res.json.message,
  };
}

async function main() {
  const { reverse, pollResults, allowMismatch, testUrl } = parseArgs(process.argv.slice(2));
  const base = process.env.PYTHH_CONTRACT_API_BASE || DEFAULT_BASE;

  if (!testUrl) {
    console.error(`Usage: node scripts/pythh-submit-gateway-contract.js <url> [flags]
  npm run contract:submit -- https://example.com
  npm run contract:submit -- --reverse https://example.com

Env: PYTHH_CONTRACT_API_BASE (default ${DEFAULT_BASE}), PYTHH_CONTRACT_TEST_URL`);
    process.exit(2);
  }

  console.log('\nPYTHH submit gateway contract');
  console.log(`  API base: ${base}`);
  console.log(`  URL:      ${testUrl}`);
  console.log(`  Order:    ${reverse ? 'instant → discovery' : 'discovery → instant'}`);
  if (allowMismatch) console.log('  Mode:     --allow-mismatch (no exit 1 on id drift)\n');
  else console.log('');

  const health = await instantHealth(base);
  if (!health.ok) {
    console.error('FAIL: server not reachable or /api/instant/health not OK:', health.status, health.text?.slice(0, 200));
    console.error('  Start API: npm run dev:server');
    process.exit(1);
  }

  const probe = await discoveryBuildProbe(base);
  console.log('Discovery build:', probe.json || probe.text?.slice(0, 160));
  const build = probe.json && typeof probe.json.build === 'string' ? probe.json.build : '';
  if (!probe.ok || build !== EXPECTED_DISCOVERY_BUILD) {
    console.error('FAIL: API is not running the current discovery submit code from this repo.');
    console.error(`  Expected GET /api/discovery/__submit_build → { build: "${EXPECTED_DISCOVERY_BUILD}" }`);
    console.error('  Got:', probe.status, build || '(missing)');
    console.error('  Fix: kill every process on port 3002, then from this repo: npm run dev:server');
    console.error('  Example: lsof -ti :3002 | xargs kill -9');
    process.exit(1);
  }

  let discoveryRes;
  let instantRes;

  if (reverse) {
    instantRes = await instantSubmit(base, testUrl);
    discoveryRes = await discoverySubmit(base, testUrl);
  } else {
    discoveryRes = await discoverySubmit(base, testUrl);
    instantRes = await instantSubmit(base, testUrl);
  }

  console.log('Discovery submit:', summarizeDiscovery(discoveryRes));
  if (!discoveryRes.ok || discoveryRes.json?.error) {
    console.error('FAIL: discovery submit', discoveryRes.status, discoveryRes.json || discoveryRes.text?.slice(0, 400));
    process.exit(1);
  }

  const jobId = discoveryRes.json?.job_id;
  if (pollResults && jobId) {
    console.log('Polling /api/discovery/results …');
    for (let k = 0; k < 5; k++) {
      const gr = await discoveryResults(base, jobId);
      const st = gr.json?.status;
      const pr = gr.json?.progress;
      console.log(`  [${k + 1}] status=${st}${pr != null ? ` progress=${pr}` : ''}`);
      if (st === 'ready' || st === 'failed' || st === 'unknown') break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log('Instant submit:   ', summarizeInstant(instantRes));

  if (!instantRes.ok) {
    console.error('FAIL: instant submit HTTP', instantRes.status, instantRes.json || instantRes.text?.slice(0, 400));
    process.exit(1);
  }

  if (instantRes.status === 202 && !instantRes.json?.startup_id) {
    console.error('INCONCLUSIVE: instant returned 202 without startup_id (timeout path). Retry or raise INSTANT budget.');
    process.exit(3);
  }

  if (instantRes.json?.error) {
    console.error('FAIL: instant body error', instantRes.json);
    process.exit(1);
  }

  const sd = discoveryRes.json?.startup_id;
  const si = instantRes.json?.startup_id;

  if (!sd || !si) {
    console.error('FAIL: missing startup_id', { discovery: sd, instant: si });
    process.exit(1);
  }

  if (sd === si) {
    console.log('\nPASS: discovery and instant resolved the same startup_id.\n');
    process.exit(0);
  }

  console.error('\nFAIL: startup_id mismatch — gateways diverged for the same URL.');
  await explainMismatch(sd, si);
  if (allowMismatch) {
    console.error('  (--allow-mismatch: exiting 0)\n');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
