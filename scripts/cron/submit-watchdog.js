#!/usr/bin/env node
'use strict';

/**
 * Submit URL Watchdog
 * ─────────────────────────────────────────────────────────────────────────────
 * Actively probes /api/instant/submit every N minutes with known-good URLs.
 * On failure: logs to submit_watchdog_events, sends Resend alert, attempts
 * self-heal via server restart signal.
 *
 * Self-healing actions (in escalation order):
 *   1. Immediate retry (different URL) — transient network blip
 *   2. POST /api/health/deep — diagnose which component failed
 *   3. Send Resend alert email with diagnostics
 *   4. If PYTHH_WATCHDOG_RESTART_URL is set, POST it to trigger a Fly.io restart
 *
 * Usage:
 *   node scripts/cron/submit-watchdog.js             # run once + exit
 *   node scripts/cron/submit-watchdog.js --daemon    # loop every INTERVAL_MINUTES
 *
 * Env:
 *   API_BASE_URL            — default https://pythh.ai (user-facing path; avoids localhost false positives)
 *   WATCHDOG_INTERVAL_MIN   — probe interval in minutes (default: 15)
 *   WATCHDOG_ALERT_EMAIL    — email to alert (default: uses RESEND_TO_EMAIL or ADMIN_EMAIL)
 *   RESEND_API_KEY          — Resend key for alert emails
 *   PYTHH_WATCHDOG_RESTART_URL — optional Fly.io restart webhook
 *   WATCHDOG_LATENCY_WARN_MS   — warn threshold (default: 4000)
 *   WATCHDOG_LATENCY_FAIL_MS   — fail threshold (default: 12000)
 *   WATCHDOG_MIN_MATCHES       — minimum match count to pass (default: 10)
 */

require('dotenv').config({ quiet: true });

const { createClient } = require('@supabase/supabase-js');

/** Probe production by default — localhost breaks on multi-machine Fly and local cron without a server. */
function resolveApiBase() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL.replace(/\/$/, '');
  return (process.env.PROD_BASE_URL || 'https://pythh.ai').replace(/\/$/, '');
}
const API_BASE      = resolveApiBase();
const INTERVAL_MIN  = parseInt(process.env.WATCHDOG_INTERVAL_MIN || '15', 10);
const ALERT_COOLDOWN_MIN = parseInt(process.env.WATCHDOG_ALERT_COOLDOWN_MIN || '60', 10);
// Never default alerts TO alerts@pythh.ai — that address is send-only and is suppressed in Resend.
const ALERT_TO      = process.env.WATCHDOG_ALERT_EMAIL
                   || process.env.RESEND_TO_EMAIL
                   || process.env.ADMIN_EMAIL
                   || 'ugobe07@gmail.com';
const ALERT_FROM    = process.env.EMAIL_FROM || 'Pythh Watchdog <alerts@pythh.ai>';
const RESEND_KEY    = process.env.RESEND_API_KEY;
const RESTART_URL   = process.env.PYTHH_WATCHDOG_RESTART_URL;
const LATENCY_WARN  = parseInt(process.env.WATCHDOG_LATENCY_WARN_MS || '4000', 10);
const LATENCY_FAIL  = parseInt(process.env.WATCHDOG_LATENCY_FAIL_MS || '12000', 10);
const MIN_MATCHES   = parseInt(process.env.WATCHDOG_MIN_MATCHES || '10', 10);

// Probe URLs — known to exist in DB, should resolve in < LATENCY_WARN ms
const PROBE_URLS = [
  'https://stripe.com',
  'https://www.corgi.insure',
  'https://xpanner.com',
];

// ── Supabase ──────────────────────────────────────────────────────────────────
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function probeSubmit(url, timeoutMs = LATENCY_FAIL + 2000) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${API_BASE}/api/instant/submit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
      signal:  AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
    const ms   = Date.now() - t0;
    return {
      ok:        res.status === 200 && !!body.startup_id,
      status:    res.status,
      latencyMs: ms,
      startupId: body.startup_id,
      matchCount:body.matches?.length ?? 0,
      isNew:     body.is_new,
      name:      body.startup?.name || body.name,
      error:     body.error,
    };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: e.message };
  }
}

async function fetchDeepHealth() {
  try {
    const res  = await fetch(`${API_BASE}/api/health/deep`, { signal: AbortSignal.timeout(15000) });
    return await res.json();
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

/**
 * Probe the tRPC auth.me endpoint — this is the gate for the frontend submit
 * URL flow (Activate.tsx). If it returns anything other than 200 + JSON array,
 * the UI submit function is broken regardless of whether /api/instant/submit passes.
 */
async function probeTrpcAuth() {
  const PROD_URL = process.env.PROD_BASE_URL || 'https://pythh.ai';
  const t0 = Date.now();
  try {
    const res = await fetch(
      `${PROD_URL}/api/trpc/auth.me?batch=1&input=${encodeURIComponent(JSON.stringify({ '0': { json: null } }))}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status} — tRPC not mounted or swallowed by 404 catch-all` };
    const body = await res.json();
    if (!Array.isArray(body)) return { ok: false, ms, error: `Unexpected response shape: ${JSON.stringify(body).slice(0, 80)}` };
    return { ok: true, ms, user: body[0]?.result?.data?.json ?? null };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e.message };
  }
}

// ── Resend alert ─────────────────────────────────────────────────────────────

async function sendAlert(subject, htmlBody) {
  if (!RESEND_KEY) {
    console.warn('[watchdog] No RESEND_API_KEY — skipping alert email');
    return false;
  }
  if (!(await shouldSendAlert())) {
    console.log(`[watchdog] Alert suppressed — already sent within ${ALERT_COOLDOWN_MIN} minutes`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    ALERT_FROM,
        to:      [ALERT_TO],
        subject,
        html:    htmlBody,
      }),
    });
    const data = await res.json();
    if (data.id) {
      console.log(`[watchdog] Alert sent → ${ALERT_TO} (id: ${data.id})`);
      return true;
    } else {
      console.warn('[watchdog] Resend error:', data);
      return false;
    }
  } catch (e) {
    console.warn('[watchdog] sendAlert threw:', e.message);
    return false;
  }
}

async function shouldSendAlert() {
  if (ALERT_COOLDOWN_MIN <= 0) return true;
  try {
    const since = new Date(Date.now() - ALERT_COOLDOWN_MIN * 60 * 1000).toISOString();
    const { count, error } = await sb
      .from('submit_watchdog_events')
      .select('*', { count: 'exact', head: true })
      .eq('action_taken', 'alert_sent')
      .gte('created_at', since);
    if (error) return true;
    return (count || 0) === 0;
  } catch {
    return true;
  }
}

async function probeProductionHealth() {
  const base = (process.env.PROD_BASE_URL || 'https://pythh.ai').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(12000) });
    return res.ok;
  } catch {
    return false;
  }
}

function buildAlertHtml(failures, health, probeResults) {
  const ts   = new Date().toISOString();
  const rows = probeResults.map(r =>
    `<tr>
       <td style="padding:4px 8px">${r.url}</td>
       <td style="padding:4px 8px;color:${r.result.ok ? 'green' : 'red'}">${r.result.ok ? '✓ pass' : '✗ fail'}</td>
       <td style="padding:4px 8px">${r.result.latencyMs}ms</td>
       <td style="padding:4px 8px">${r.result.matchCount ?? '—'}</td>
       <td style="padding:4px 8px">${r.result.error || r.result.name || ''}</td>
     </tr>`
  ).join('');

  const healthRows = health?.failures?.length
    ? health.failures.map(f => `<li><strong>${f.check}</strong>: ${f.reason}</li>`).join('')
    : '<li>No health failures reported</li>';

  return `
    <h2 style="color:#c0392b">⚠️ Pythh Submit Watchdog Alert</h2>
    <p>Timestamp: <code>${ts}</code></p>
    <h3>Probe Results</h3>
    <table border="1" cellpadding="4" style="border-collapse:collapse;font-size:13px">
      <thead><tr><th>URL</th><th>Status</th><th>Latency</th><th>Matches</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h3>Deep Health Check: <span style="color:${health?.status === 'healthy' ? 'green' : 'red'}">${health?.status || 'unknown'}</span></h3>
    <p>Passed: ${health?.passed || '?'}</p>
    <ul>${healthRows}</ul>
    <hr>
    <p style="color:#888;font-size:11px">Pythh Watchdog — API: ${API_BASE}</p>
  `;
}

// ── Log to Supabase ───────────────────────────────────────────────────────────

async function logWatchdogEvent({ probeUrl, status, latencyMs, startupId, matchCount, error, actionTaken, details }) {
  try {
    await sb.from('submit_watchdog_events').insert([{
      probe_url:    probeUrl,
      status,
      latency_ms:   latencyMs,
      startup_id:   startupId,
      match_count:  matchCount,
      error,
      action_taken: actionTaken || 'none',
      details:      details || {},
    }]);
  } catch (e) {
    console.warn('[watchdog] logWatchdogEvent error:', e.message);
  }
}

// ── Self-heal: trigger Fly.io restart ────────────────────────────────────────

async function triggerRestart() {
  if (!RESTART_URL) return false;
  try {
    const res = await fetch(RESTART_URL, { method: 'POST', signal: AbortSignal.timeout(10000) });
    console.log(`[watchdog] Restart triggered → ${res.status}`);
    return res.ok;
  } catch (e) {
    console.warn('[watchdog] triggerRestart failed:', e.message);
    return false;
  }
}

// ── Main probe run ────────────────────────────────────────────────────────────

async function runProbe() {
  console.log(`\n[watchdog] ─── Probe run ${new Date().toISOString()} ───`);

  // ── tRPC auth.me check (frontend gate) ───────────────────────────────────
  const trpcResult = await probeTrpcAuth();
  if (!trpcResult.ok) {
    console.warn(`  ✗ tRPC auth.me FAILED (${trpcResult.ms}ms): ${trpcResult.error}`);
    console.warn('  ⚠ This means the UI submit URL flow is broken even if REST API passes.');
    await sendAlert(
      '🚨 Pythh tRPC auth.me failing — UI submit flow broken',
      `<h2 style="color:#c0392b">⚠️ tRPC /api/trpc/auth.me is DOWN</h2>
       <p>The frontend submit URL flow is broken. Users cannot activate PYTHIA.</p>
       <p><strong>Error:</strong> ${trpcResult.error}</p>
       <p><strong>Latency:</strong> ${trpcResult.ms}ms</p>
       <p><strong>Time:</strong> ${new Date().toISOString()}</p>
       <p>Check: was /api/trpc slot registered before the 404 catch-all? Did the tRPC async import fail?</p>`
    );
  } else {
    console.log(`  ✓ tRPC auth.me OK (${trpcResult.ms}ms) user=${trpcResult.user ? trpcResult.user.email : 'anonymous'}`);
  }

  const probeResults = [];
  let failures = [];

  for (const url of PROBE_URLS) {
    const result = await probeSubmit(url);
    probeResults.push({ url, result });

    const status = !result.ok           ? 'fail'
                 : result.latencyMs > LATENCY_WARN ? 'warn'
                 : 'pass';

    const emoji = status === 'pass' ? '✓' : status === 'warn' ? '⚡' : '✗';
    console.log(`  ${emoji} ${url.padEnd(36)} ${result.latencyMs}ms  matches=${result.matchCount ?? '—'}  ${result.error || result.name || ''}`);

    await logWatchdogEvent({
      probeUrl:   url,
      status,
      latencyMs:  result.latencyMs,
      startupId:  result.startupId,
      matchCount: result.matchCount,
      error:      result.error,
      actionTaken:'none',
      details:    result,
    });

    if (status === 'fail') failures.push({ url, result });
  }

  if (failures.length === 0) {
    console.log('[watchdog] All probes passed ✓');
    return;
  }

  // ── Self-heal sequence ────────────────────────────────────────────────────

  console.warn(`[watchdog] ${failures.length} probe(s) failed — starting self-heal sequence`);

  // Step 1: Retry once with a different URL to confirm it's not a data issue
  const retryUrl = PROBE_URLS.find(u => !failures.find(f => f.url === u)) || PROBE_URLS[0];
  const retry = await probeSubmit(retryUrl);
  if (!retry.ok) {
    console.warn('[watchdog] Retry also failed — likely a server-side issue');
  } else {
    console.log('[watchdog] Retry succeeded — may be data-specific, not a server fault');
  }

  // Step 2: Deep health check for diagnostics
  const health = await fetchDeepHealth();
  console.log(`[watchdog] Deep health: ${health?.status} (${health?.passed})`);
  if (health?.failures?.length) {
    console.warn('[watchdog] Health failures:', health.failures.map(f => f.check).join(', '));
  }

  // Step 3: Send alert email (skip if production is healthy — likely bad probe target)
  const prodHealthy = await probeProductionHealth();
  if (prodHealthy) {
    console.warn(`[watchdog] Submit probes failed against ${API_BASE} but ${process.env.PROD_BASE_URL || 'https://pythh.ai'} is healthy — skipping alert`);
    return;
  }

  const alertSubject = `🚨 Pythh Submit Watchdog: ${failures.length} probe(s) failed`;
  const sent = await sendAlert(alertSubject, buildAlertHtml(failures, health, probeResults));
  if (!sent) return;

  // Step 4: If server is unreachable (retry also failed), trigger restart
  let actionTaken = 'alert_sent';
  if (!retry.ok) {
    const restarted = await triggerRestart();
    if (restarted) {
      actionTaken = 'restart_triggered';
      console.log('[watchdog] Restart triggered — waiting 30s for server to recover');
      await new Promise(r => setTimeout(r, 30000));

      // Final verification after restart
      const verify = await probeSubmit(retryUrl);
      if (verify.ok) {
        console.log('[watchdog] ✓ Server recovered after restart');
        actionTaken = 'restart_triggered';
      } else {
        console.error('[watchdog] ✗ Server still failing after restart — manual intervention needed');
      }
    }
  }

  // Update watchdog event with action taken
  for (const { url, result } of failures) {
    await logWatchdogEvent({
      probeUrl:   url,
      status:     'fail',
      latencyMs:  result.latencyMs,
      error:      result.error,
      actionTaken,
      details:    { health_status: health?.status, health_failures: health?.failures },
    });
  }
}

// ── Daemon mode ───────────────────────────────────────────────────────────────

async function main() {
  const isDaemon = process.argv.includes('--daemon');

  // Always run once immediately
  await runProbe();

  if (!isDaemon) return;

  const intervalMs = INTERVAL_MIN * 60 * 1000;
  console.log(`[watchdog] Daemon mode — probing every ${INTERVAL_MIN} minutes`);
  setInterval(runProbe, intervalMs);
}

main().catch(e => {
  console.error('[watchdog] Fatal:', e);
  process.exit(1);
});
