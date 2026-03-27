#!/usr/bin/env node
/**
 * pythh Production Health Suite
 * ================================
 * Tests the live production app end-to-end: API endpoints + DB stats.
 *
 * Usage:
 *   node scripts/prod-health.js                         # defaults to https://pythh.ai
 *   node scripts/prod-health.js --url https://pythh.ai  # custom URL
 *   node scripts/prod-health.js --verbose               # show response bodies
 *
 * Exit codes:
 *   0 = all checks pass (or warn-only)
 *   1 = one or more failures
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ── Config ───────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const urlArg = args.find(a => a.startsWith('--url='))?.split('=')[1]
             || (args.includes('--url') ? args[args.indexOf('--url') + 1] : null);
const VERBOSE = args.includes('--verbose') || args.includes('-v');

const BASE_URL = (urlArg || 'https://pythh.ai').replace(/\/$/, '');
const TIMEOUT  = 10_000; // ms per request

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ── State ────────────────────────────────────────────────────────────────────
let passed = 0, warned = 0, failed = 0;

function pass(label, detail = '') {
  passed++;
  console.log(`  ${C.green('✓')} ${label}${detail ? C.dim('  — ' + detail) : ''}`);
}
function warn(label, detail = '') {
  warned++;
  console.log(`  ${C.yellow('⚠')} ${label}${detail ? C.dim('  — ' + detail) : ''}`);
}
function fail(label, detail = '') {
  failed++;
  console.log(`  ${C.red('✗')} ${label}${detail ? C.dim('  — ' + detail) : ''}`);
}
function section(title) {
  console.log(`\n${C.bold(C.cyan('▸ ' + title))}`);
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function get(path, opts = {}) {
  const url  = `${BASE_URL}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? TIMEOUT);
  const start = Date.now();
  try {
    const res  = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'pythh-health/1.0' } });
    const ms   = Date.now() - start;
    let   body = null;
    try { body = await res.json(); } catch { body = null; }
    if (VERBOSE && body) console.log(C.dim('     ' + JSON.stringify(body).slice(0, 200)));
    return { ok: res.ok, status: res.status, body, ms };
  } catch (err) {
    const ms = Date.now() - start;
    return { ok: false, status: 0, body: null, ms, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Section 1: Core API ──────────────────────────────────────────────────────
async function checkCoreApi() {
  section('Core API');

  // /api/health
  const h = await get('/api/health');
  if (h.ok && h.body?.status === 'ok') {
    pass('/api/health', `${h.ms}ms · DB connected`);
  } else if (h.ok && h.body?.status === 'degraded') {
    warn('/api/health', `degraded — ${h.body?.database?.error ?? 'unknown'}`);
  } else {
    fail('/api/health', h.error ?? `HTTP ${h.status}`);
  }

  // /api/engine/status
  const e = await get('/api/engine/status');
  if (e.ok) {
    pass('/api/engine/status', `${e.ms}ms`);
  } else {
    warn('/api/engine/status', e.error ?? `HTTP ${e.status}`);
  }

  // /api/pulse
  const p = await get('/api/pulse');
  if (p.ok) {
    pass('/api/pulse', `${p.ms}ms`);
  } else {
    warn('/api/pulse', p.error ?? `HTTP ${p.status}`);
  }
}

// ── Section 2: Match Engine ──────────────────────────────────────────────────
async function checkMatchEngine() {
  section('Match Engine');

  // /api/hot-matches
  const hm = await get('/api/hot-matches?limit_count=5');
  if (!hm.ok) {
    fail('/api/hot-matches', hm.error ?? `HTTP ${hm.status}`);
  } else {
    const matches = hm.body?.matches ?? [];
    if (matches.length >= 5) {
      pass('/api/hot-matches', `${matches.length} matches returned · ${hm.ms}ms`);
    } else if (matches.length > 0) {
      warn('/api/hot-matches', `only ${matches.length} matches (expected ≥5) · ${hm.ms}ms`);
    } else {
      fail('/api/hot-matches', 'no matches returned');
    }

    // Validate shape of first match
    if (matches.length > 0) {
      const m = matches[0];
      const fields = ['match_id', 'startup_name', 'investor_name', 'match_score'];
      const missing = fields.filter(f => m[f] == null);
      if (missing.length === 0) {
        pass('match shape', `all required fields present`);
      } else {
        warn('match shape', `missing fields: ${missing.join(', ')}`);
      }
    }
  }

  // /api/live-pairings
  const lp = await get('/api/live-pairings?limit=3');
  if (lp.ok) {
    pass('/api/live-pairings', `${lp.ms}ms`);
  } else {
    warn('/api/live-pairings', lp.error ?? `HTTP ${lp.status}`);
  }

  // /api/trending
  const t = await get('/api/trending');
  if (t.ok) {
    const count = t.body?.total ?? (Array.isArray(t.body?.data) ? t.body.data.length : '?');
    pass('/api/trending', `${count} startups · ${t.ms}ms`);
  } else {
    warn('/api/trending', t.error ?? `HTTP ${t.status}`);
  }
}

// ── Section 3: Signals & Discovery ──────────────────────────────────────────
async function checkSignals() {
  section('Signals & Discovery');

  // /api/live-signals
  const ls = await get('/api/live-signals?limit=5');
  if (ls.ok) {
    const count = ls.body?.signals?.length ?? 0;
    if (count > 0) {
      pass('/api/live-signals', `${count} signals · ${ls.ms}ms`);
    } else {
      warn('/api/live-signals', 'no signals returned (ai_logs may have no signal-type entries)');
    }
  } else if (ls.status === 500) {
    fail('/api/live-signals', `server error — ${ls.body?.error ?? 'check ai_logs table'}`);
  } else {
    warn('/api/live-signals', ls.error ?? `HTTP ${ls.status}`);
  }

  // /api/discovery/convergence — requires ?url= param
  const dc = await get('/api/discovery/convergence?url=https://pythh.ai', { timeout: 20_000 });
  if (dc.ok && dc.body?.status) {
    const st = dc.body.status;
    const summary = typeof st === 'object'
      ? `fomo=${st.fomo_state ?? '?'} signal=${st.signal_strength_0_10 ?? '?'}/10`
      : st;
    pass('/api/discovery/convergence', `${summary} · ${dc.ms}ms`);
  } else if (dc.ok) {
    pass('/api/discovery/convergence', `${dc.ms}ms`);
  } else if (dc.status === 400) {
    fail('/api/discovery/convergence', `400 — missing url param (check health script)`);
  } else {
    warn('/api/discovery/convergence', dc.error ?? `HTTP ${dc.status}`);
  }
}

// ── Section 4: Database Stats ────────────────────────────────────────────────
async function checkDatabase() {
  section('Database');

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    warn('Supabase env vars not set — skipping DB checks');
    return;
  }

  const sb = createClient(url, key);

  // Startup count + GOD score
  try {
    const { data, error, count } = await sb
      .from('startup_uploads')
      .select('total_god_score', { count: 'exact' })
      .eq('status', 'approved');

    if (error) throw error;
    const total = count ?? data?.length ?? 0;
    const avg   = data?.length
      ? Math.round(data.reduce((s, r) => s + (r.total_god_score ?? 0), 0) / data.length)
      : 0;
    const atFloor = data?.filter(r => r.total_god_score <= 41).length ?? 0;
    const pctFloor = total ? Math.round((atFloor / total) * 100) : 0;

    if (total > 5000) {
      pass(`startups (approved)`, `${total.toLocaleString()} · avg GOD ${avg}`);
    } else {
      warn(`startups (approved)`, `only ${total.toLocaleString()} (expected >5000)`);
    }

    if (avg >= 52) {
      pass(`GOD score avg`, `${avg} (target ≥52)`);
    } else if (avg >= 45) {
      warn(`GOD score avg`, `${avg} — below target of 52`);
    } else {
      fail(`GOD score avg`, `${avg} — critically low (target ≥52)`);
    }

    if (pctFloor > 60) {
      fail(`GOD score floor bunching`, `${pctFloor}% of startups at/near floor (≤41)`);
    } else if (pctFloor > 40) {
      warn(`GOD score floor bunching`, `${pctFloor}% at floor`);
    } else {
      pass(`GOD score distribution`, `${pctFloor}% at floor — healthy spread`);
    }
  } catch (err) {
    fail('startup_uploads query', err.message);
  }

  // Investor count
  try {
    const { count } = await sb
      .from('investors')
      .select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 1000) {
      pass('investors', `${(count).toLocaleString()} total`);
    } else {
      warn('investors', `only ${count ?? 0} (expected >1000)`);
    }
  } catch (err) {
    fail('investors query', err.message);
  }

  // Match count + freshness
  try {
    const { count } = await sb
      .from('startup_investor_matches')
      .select('id', { count: 'exact', head: true });

    if ((count ?? 0) > 500_000) {
      pass('matches', `${(count).toLocaleString()} total`);
    } else if ((count ?? 0) > 50_000) {
      warn('matches', `${(count ?? 0).toLocaleString()} — lower than expected (>500k)`);
    } else {
      fail('matches', `only ${(count ?? 0).toLocaleString()} — match engine may need regeneration`);
    }
  } catch (err) {
    fail('startup_investor_matches query', err.message);
  }

  // Recent discoveries (scraper activity)
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('startup_uploads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cutoff);
    if ((count ?? 0) >= 5) {
      pass('data freshness (last 24h)', `${count} new startups ingested`);
    } else if ((count ?? 0) > 0) {
      warn('data freshness (last 24h)', `only ${count} new startups — scraper may be slow`);
    } else {
      fail('data freshness (last 24h)', 'no new startups in 24h — scraper likely down');
    }
  } catch (err) {
    fail('freshness check', err.message);
  }
}

// ── Section 5: Response Time ─────────────────────────────────────────────────
async function checkResponseTimes() {
  section('Response Times');

  const endpoints = [
    '/api/health',
    '/api/hot-matches?limit_count=3',
    '/api/trending',
    '/api/live-signals?limit=3',
  ];

  for (const ep of endpoints) {
    const r = await get(ep);
    const ms = r.ms;
    if (!r.ok) continue; // already reported above
    if (ms < 400) {
      pass(ep, `${ms}ms`);
    } else if (ms < 1500) {
      warn(ep, `${ms}ms — slow`);
    } else {
      fail(ep, `${ms}ms — too slow (>1.5s)`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();

  console.log(C.bold('\n══════════════════════════════════════════════════'));
  console.log(C.bold('  pythh Production Health Suite'));
  console.log(C.bold('══════════════════════════════════════════════════'));
  console.log(C.dim(`  Target: ${BASE_URL}`));
  console.log(C.dim(`  Time:   ${new Date().toUTCString()}`));

  await checkCoreApi();
  await checkMatchEngine();
  await checkSignals();
  await checkDatabase();
  await checkResponseTimes();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n${C.bold('══════════════════════════════════════════════════')}`);
  console.log(`  ${C.green(`✓ ${passed} passed`)}  ${C.yellow(`⚠ ${warned} warned`)}  ${failed > 0 ? C.red(`✗ ${failed} failed`) : C.dim(`✗ ${failed} failed`)}  ${C.dim(`(${elapsed}s)`)}`);

  if (failed === 0 && warned === 0) {
    console.log(`\n  ${C.green(C.bold('ALL CHECKS PASSED'))} 🟢`);
  } else if (failed === 0) {
    console.log(`\n  ${C.yellow(C.bold('PASSED WITH WARNINGS'))} 🟡`);
  } else {
    console.log(`\n  ${C.red(C.bold('HEALTH CHECK FAILED'))} 🔴`);
  }
  console.log(C.bold('══════════════════════════════════════════════════\n'));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(C.red(`\nFatal: ${err.message}`));
  process.exit(1);
});
