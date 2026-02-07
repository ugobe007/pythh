#!/usr/bin/env node
/**
 * SUBMIT FLOW GUARDIAN
 * ====================
 * Continuously monitors the critical URL → matches pipeline.
 * Auto-heals when possible, alerts when manual intervention needed.
 *
 * PM2: Runs every 2 minutes via cron_restart.
 *
 * Monitors:
 *   1. Express server (port 3002) alive
 *   2. /api/instant/submit returns valid response
 *   3. Database schema integrity (investor/startup columns)
 *   4. RPC fallback (resolve_startup_by_url) operational
 *   5. Match generation pipeline functional
 *
 * Auto-heals:
 *   - Restarts api-server PM2 process if dead
 *   - Clears investor cache if schema errors detected
 *   - Logs all incidents to ai_logs table for audit trail
 *
 * Run manually:  node scripts/submit-flow-guardian.js
 * Run via PM2:   pm2 start ecosystem.config.js (included as submit-guardian)
 */

const path = require('path');
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  try { dotenv = require(path.join(__dirname, '..', 'node_modules', 'dotenv')); } catch (_) {}
}
if (dotenv) dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const SERVER_URL = process.env.API_URL || 'http://localhost:3002';
const TEST_URL = 'stripe.com';

// Required columns the submit flow depends on
const REQUIRED_INVESTOR_COLS = [
  'id', 'name', 'firm', 'url', 'sectors', 'stage',
  'total_investments', 'active_fund_size', 'investment_thesis', 'type', 'status',
];
const REQUIRED_STARTUP_COLS = [
  'id', 'name', 'website', 'sectors', 'stage', 'total_god_score', 'status',
];

// ─── Logging ────────────────────────────────────────────────────────────────

const C = {
  R: '\x1b[31m', G: '\x1b[32m', Y: '\x1b[33m', B: '\x1b[34m',
  C: '\x1b[36m', X: '\x1b[0m', BOLD: '\x1b[1m',
};

function log(level, msg) {
  const colors = { OK: C.G, WARN: C.Y, ERROR: C.R, INFO: C.B, HEAL: C.C };
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${ts} ${colors[level] || ''}[${level}]${C.X} ${msg}`);
}

async function logToDb(level, message, details = {}) {
  try {
    await supabase.from('ai_logs').insert({
      operation: `submit-guardian:${level}`,
      model: 'guardian-v1',
      status: level === 'error' ? 'failed' : 'success',
      error_message: `${message} | ${JSON.stringify(details).slice(0, 500)}`,
      input_tokens: 0,
      output_tokens: 0,
      created_at: new Date().toISOString(),
    });
  } catch (_) {
    // Non-fatal — DB logging is best-effort
  }
}

// ─── Checks ─────────────────────────────────────────────────────────────────

async function checkServerAlive() {
  try {
    const r = await fetch(`${SERVER_URL}/api/instant/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { ok: false, error: `Health returned HTTP ${r.status}` };
    const body = await r.json();
    if (body.status !== 'ok') return { ok: false, error: 'Health status not ok' };
    if (!body.active_investors || body.active_investors < 10) {
      return { ok: false, error: `Only ${body.active_investors} active investors` };
    }
    return { ok: true, investors: body.active_investors };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkSubmitEndpoint() {
  try {
    const r = await fetch(`${SERVER_URL}/api/instant/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_URL }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) {
      const text = await r.text();
      return { ok: false, error: `HTTP ${r.status}: ${text.slice(0, 200)}` };
    }
    const body = await r.json();
    if (!body.startup_id) return { ok: false, error: 'No startup_id returned' };
    const matchCount = body.matches?.length || body.match_count || 0;
    if (matchCount === 0) return { ok: false, error: 'Zero matches returned' };
    return { ok: true, startup_id: body.startup_id, matches: matchCount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkSchemaIntegrity() {
  const issues = [];
  const sbUrl = process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) return { ok: true, skipped: true };

  const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}` };

  // Check investors columns
  try {
    const r = await fetch(
      `${sbUrl}/rest/v1/investors?select=${REQUIRED_INVESTOR_COLS.join(',')}&limit=1`,
      { headers }
    );
    if (!r.ok) issues.push(`investors: ${(await r.text()).slice(0, 100)}`);
  } catch (e) {
    issues.push(`investors: ${e.message}`);
  }

  // Check startup_uploads columns
  try {
    const r = await fetch(
      `${sbUrl}/rest/v1/startup_uploads?select=${REQUIRED_STARTUP_COLS.join(',')}&limit=1`,
      { headers }
    );
    if (!r.ok) issues.push(`startup_uploads: ${(await r.text()).slice(0, 100)}`);
  } catch (e) {
    issues.push(`startup_uploads: ${e.message}`);
  }

  // Check RPC
  try {
    const r = await fetch(`${sbUrl}/rest/v1/rpc/resolve_startup_by_url`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: 'test.com' }),
    });
    if (!r.ok) issues.push(`RPC: HTTP ${r.status}`);
  } catch (e) {
    issues.push(`RPC: ${e.message}`);
  }

  return { ok: issues.length === 0, issues };
}

// ─── Auto-Healing ───────────────────────────────────────────────────────────

function tryRestartServer() {
  log('HEAL', 'Attempting to restart api-server via PM2...');
  try {
    // Check if PM2 is managing api-server
    const list = execSync('pm2 jlist 2>/dev/null || echo "[]"').toString();
    const procs = JSON.parse(list);
    const apiProc = procs.find(p => p.name === 'api-server');

    if (apiProc) {
      execSync('pm2 restart api-server 2>/dev/null');
      log('HEAL', 'PM2 api-server restarted');
      return { healed: true, method: 'pm2_restart' };
    }

    // Not in PM2 — try starting fresh
    execSync('pm2 start ecosystem.config.js --only api-server 2>/dev/null');
    log('HEAL', 'PM2 api-server started from ecosystem.config.js');
    return { healed: true, method: 'pm2_start' };
  } catch (e) {
    log('ERROR', `Auto-heal failed: ${e.message}`);
    return { healed: false, error: e.message };
  }
}

// ─── Main Guardian Loop ─────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now();
  const results = { timestamp: new Date().toISOString(), checks: {}, healed: false };

  console.log(`\n${C.BOLD}═══ SUBMIT FLOW GUARDIAN ═══${C.X}  ${results.timestamp}\n`);

  // ── 1. Server alive ──────────────────────────────────────────
  log('INFO', 'Checking Express server...');
  const server = await checkServerAlive();
  results.checks.server = server;

  if (server.ok) {
    log('OK', `Server alive (${server.investors} investors cached)`);
  } else {
    log('ERROR', `Server DOWN: ${server.error}`);
    await logToDb('error', 'Express server unreachable', server);

    // AUTO-HEAL: Try to restart
    const heal = tryRestartServer();
    results.healed = heal.healed;

    if (heal.healed) {
      log('HEAL', `Server restarted via ${heal.method}. Waiting 8s for boot...`);
      await logToDb('info', 'Auto-healed: server restarted', heal);
      await new Promise(r => setTimeout(r, 8000));

      // Re-check
      const recheck = await checkServerAlive();
      if (recheck.ok) {
        log('OK', 'Server recovered after restart');
        results.checks.server = recheck;
      } else {
        log('ERROR', 'Server still down after restart');
        await logToDb('error', 'Server failed to recover after restart', recheck);
      }
    }
  }

  // ── 2. Submit endpoint ───────────────────────────────────────
  if (results.checks.server?.ok) {
    log('INFO', `Testing submit with "${TEST_URL}"...`);
    const submit = await checkSubmitEndpoint();
    results.checks.submit = submit;

    if (submit.ok) {
      log('OK', `Submit works (${submit.matches} matches for ${TEST_URL})`);
    } else {
      log('ERROR', `Submit BROKEN: ${submit.error}`);
      await logToDb('error', 'Submit endpoint broken', submit);

      // If it's a column error, the cache might be stale
      if (submit.error.includes('column') && submit.error.includes('does not exist')) {
        log('HEAL', 'Detected schema mismatch — restarting server to clear cache...');
        const heal = tryRestartServer();
        if (heal.healed) {
          await logToDb('warn', 'Restarted server to clear investor cache after schema error', heal);
        }
      }
    }
  } else {
    log('WARN', 'Skipping submit test (server unavailable)');
    results.checks.submit = { ok: false, skipped: true };
  }

  // ── 3. Schema integrity ──────────────────────────────────────
  log('INFO', 'Validating database schema...');
  const schema = await checkSchemaIntegrity();
  results.checks.schema = schema;

  if (schema.skipped) {
    log('WARN', 'Schema check skipped (no Supabase credentials)');
  } else if (schema.ok) {
    log('OK', 'All required columns + RPC exist');
  } else {
    log('ERROR', `Schema issues: ${schema.issues.join('; ')}`);
    await logToDb('error', 'Database schema integrity failed', schema);
  }

  // ── Summary ──────────────────────────────────────────────────
  const elapsed = Date.now() - startTime;
  const allOk = Object.values(results.checks).every(c => c.ok || c.skipped);

  console.log(`\n${C.BOLD}─── Summary ───${C.X}`);
  for (const [name, check] of Object.entries(results.checks)) {
    const icon = check.ok ? `${C.G}✅` : check.skipped ? `${C.Y}⏭️` : `${C.R}❌`;
    console.log(`  ${icon} ${name}${C.X}`);
  }
  console.log(`\n  ${allOk ? `${C.G}HEALTHY` : `${C.R}DEGRADED`}${C.X}  (${elapsed}ms)\n`);

  // Log summary to DB
  await logToDb(
    allOk ? 'info' : 'error',
    `Health check: ${allOk ? 'HEALTHY' : 'DEGRADED'} (${elapsed}ms)`,
    results
  );

  return allOk;
}

// ─── Execute ────────────────────────────────────────────────────────────────

run()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(e => {
    console.error('Guardian fatal:', e);
    process.exit(1);
  });
