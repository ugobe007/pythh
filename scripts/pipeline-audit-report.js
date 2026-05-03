#!/usr/bin/env node
/**
 * Combined pipeline audit — one report for scrapers, enrichment, scores, matches, signals, and API.
 *
 * Usage:
 *   node scripts/pipeline-audit-report.js
 *   node scripts/pipeline-audit-report.js --json          # machine-readable
 *   node scripts/pipeline-audit-report.js --no-api      # DB only (skip HTTP)
 *   node scripts/pipeline-audit-report.js --url https://api.example.com
 *
 * Env:
 *   PROD_HEALTH_API_BASE   API origin for /api/* checks (else --url, else skipped unless VITE_API_URL)
 *   VITE_API_URL           Used as API base if PROD_HEALTH_API_BASE unset (dev often localhost)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const { createClient } = require('@supabase/supabase-js');
const { fetchAllPages } = require('./lib/supabasePaginate');

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const NO_API = args.includes('--no-api');
const urlArg =
  args.find((a) => a.startsWith('--url='))?.split('=')[1] ||
  (() => {
    const i = args.indexOf('--url');
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  })();

function apiBase() {
  if (NO_API) return null;
  return (
    urlArg ||
    process.env.PROD_HEALTH_API_BASE ||
    process.env.VITE_API_URL ||
    process.env.VITE_BACKEND_URL ||
    null
  );
}

/** Obvious placeholder / example hosts — skip HTTP to avoid noisy "fetch failed" warnings. */
function isPlaceholderApiBase(base) {
  if (!base) return true;
  const u = String(base).toLowerCase();
  return (
    u.includes('your-api-host') ||
    u.includes('example.com') ||
    /^https?:\/\/api\.?$/i.test(u)
  );
}

function sb() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY (or ROLE)');
  return createClient(url, key);
}

function grade(ok, warn) {
  if (!ok) return 'FAIL';
  if (warn) return 'WARN';
  return 'PASS';
}

async function httpGet(base, path, timeoutMs = 12_000) {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'pythh-pipeline-audit/1.0' },
    });
    let body = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    }
    return { ok: res.ok, status: res.status, body, ms: 0 };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

function formatSbError(e) {
  if (e == null) return 'unknown error';
  if (typeof e === 'string') return e;
  const m = e.message || e.msg || (e.error && e.error.message);
  if (m) {
    const bits = [m];
    if (e.details) bits.push(String(e.details));
    if (e.hint) bits.push(`hint: ${e.hint}`);
    if (e.code) bits.push(`code: ${e.code}`);
    return bits.join(' · ');
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function countExact(client, table, match = {}) {
  // Use * — not all tables have an `id` column (e.g. startup_signal_scores PK is startup_id).
  let q = client.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(match)) {
    if (v === null) q = q.is(k, null);
    else if (typeof v === 'object' && v.op === 'gte') q = q.gte(k, v.val);
    else q = q.eq(k, v);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const started = Date.now();
  const report = {
    timestamp: new Date().toISOString(),
    sections: {},
    grades: [],
    warnings: [],
    failures: [],
  };

  const log = (line = '') => {
    if (!JSON_MODE) console.log(line);
  };

  const section = (title) => {
    log(`\n━━ ${title} ━━`);
  };

  log('\n═══════════════════════════════════════════════════════════════');
  log('  PYTHH PIPELINE AUDIT (combined report)');
  log(`  ${report.timestamp}`);
  log('═══════════════════════════════════════════════════════════════');

  const client = sb();
  const host = (process.env.VITE_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
  log(`\n  Supabase: ${host || '(url unset)'}`);

  // ── Startups & enrichment ──────────────────────────────────────────────
  section('Startups & enrichment');
  const startupByStatus = {};
  for (const st of ['approved', 'pending', 'reviewing', 'rejected', 'published', 'holding']) {
    startupByStatus[st] = await countExact(client, 'startup_uploads', { status: st });
  }
  const startupTotal = Object.values(startupByStatus).reduce((a, b) => a + b, 0);
  report.sections.startups = { byStatus: startupByStatus, totalRowEstimate: startupTotal };
  log(`  startup_uploads (by status): ${JSON.stringify(startupByStatus)}`);

  let enrichedPct = null;
  try {
    const approvedRows = await fetchAllPages((from, to) =>
      client
        .from('startup_uploads')
        .select('enrichment_status')
        .eq('status', 'approved')
        .range(from, to)
    );
    const n = approvedRows.length;
    const enriched = approvedRows.filter((r) => r.enrichment_status === 'enriched').length;
    enrichedPct = n ? Math.round((enriched / n) * 100) : 0;
    report.sections.enrichment = { approvedSample: n, enrichedPct };
    log(`  approved rows scanned: ${n} · enriched: ${enrichedPct}%`);
    const g = grade(n > 0, enrichedPct < 50);
    report.grades.push({ name: 'enrichment_coverage', grade: g });
    if (g === 'WARN') report.warnings.push('Low enriched % on approved startups');
  } catch (e) {
    log(`  enrichment scan: ${e.message}`);
    report.failures.push(`enrichment scan: ${e.message}`);
  }

  // ── Discovered (RSS intake) ────────────────────────────────────────────
  section('Discovered startups (RSS → staging)');
  let discovered = { total: null, pendingImport: null };
  try {
    discovered.total = await countExact(client, 'discovered_startups', {});
    try {
      discovered.pendingImport = await countExact(client, 'discovered_startups', {
        imported_to_startups: false,
      });
    } catch {
      discovered.pendingImport = null;
    }
    report.sections.discovered = discovered;
    log(`  discovered_startups: ${discovered.total} rows${discovered.pendingImport != null ? ` · not imported: ${discovered.pendingImport}` : ''}`);
  } catch (e) {
    log(`  discovered_startups: unavailable (${e.message})`);
    report.sections.discovered = { error: e.message };
  }

  // ── RSS sources ────────────────────────────────────────────────────────
  section('RSS sources (scraper fuel)');
  let rss = {};
  try {
    const active = await countExact(client, 'rss_sources', { active: true });
    const never = await countExact(client, 'rss_sources', { active: true, last_scraped: null });
    const staleCut = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    let stale = 0;
    {
      const { count, error } = await client
        .from('rss_sources')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .lt('last_scraped', staleCut);
      if (!error) stale = count ?? 0;
    }
    rss = { active, neverScraped: never, stale48h: stale };
    report.sections.rss = rss;
    log(`  active: ${active} · never scraped: ${never} · stale >48h: ${stale}`);
    if (never > 30) report.warnings.push(`${never} RSS feeds never scraped`);
    if (stale > 80) report.warnings.push(`${stale} RSS feeds stale >48h`);
  } catch (e) {
    log(`  rss_sources: ${e.message}`);
    report.sections.rss = { error: e.message };
  }

  // ── GOD scores (approved) ──────────────────────────────────────────────
  section('GOD scores (approved)');
  try {
    const godRows = await fetchAllPages((from, to) =>
      client
        .from('startup_uploads')
        .select('total_god_score')
        .eq('status', 'approved')
        .range(from, to)
    );
    const nums = godRows
      .map((r) => r.total_god_score)
      .filter((v) => v != null && !Number.isNaN(Number(v)))
      .map(Number);
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    const min = nums.length ? Math.min(...nums) : null;
    const max = nums.length ? Math.max(...nums) : null;
    const atFloor = nums.filter((x) => x <= 41).length;
    report.sections.god = {
      n: nums.length,
      avg: Math.round(avg * 10) / 10,
      min,
      max,
      pctAtFloor41: nums.length ? Math.round((atFloor / nums.length) * 100) : null,
    };
    log(`  n=${nums.length} avg=${report.sections.god.avg} range=${min}-${max} · ≤41: ${report.sections.god.pctAtFloor41}%`);
    if (avg < 45) report.warnings.push('GOD average below 45 on approved set');
  } catch (e) {
    log(`  GOD: ${e.message}`);
    report.failures.push(`GOD: ${e.message}`);
  }

  // ── Matches ─────────────────────────────────────────────────────────────
  section('Matches');
  try {
    const m = await countExact(client, 'startup_investor_matches', {});
    report.sections.matches = { total: m };
    log(`  startup_investor_matches: ${m?.toLocaleString?.() ?? m}`);
    if (m < 10_000) report.warnings.push('Match count very low (<10k)');
  } catch (e) {
    log(`  matches: ${e.message}`);
    report.failures.push(`matches: ${e.message}`);
  }

  // ── Signals ─────────────────────────────────────────────────────────────
  section('Signals');
  try {
    const sigN = await countExact(client, 'startup_signal_scores', {});
    const { data: lastRows, error: sigErr } = await client
      .from('startup_signal_scores')
      .select('as_of')
      .order('as_of', { ascending: false })
      .limit(1);
    if (sigErr) throw sigErr;
    const lastAsOf = lastRows?.[0]?.as_of ?? null;
    report.sections.signals = { startup_signal_scores: sigN, lastAsOf };
    log(`  startup_signal_scores rows: ${sigN} · last as_of: ${lastAsOf ?? '—'}`);
  } catch (e) {
    const msg = formatSbError(e);
    log(`  startup_signal_scores: error — ${msg}`);
    report.sections.signals = { error: msg };
  }

  let aiLogs7d = null;
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count, error: aiCountErr } = await client
      .from('ai_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);
    if (aiCountErr) throw aiCountErr;
    aiLogs7d = count ?? 0;
    report.sections.ai_logs_7d = aiLogs7d;
    log(`  ai_logs (last 7d): ${aiLogs7d} rows`);
  } catch {
    log('  ai_logs: (skipped or table restricted)');
  }

  // ── HTTP API (optional) ───────────────────────────────────────────────────
  const base = apiBase();
  section('HTTP API');
  if (!base) {
    log('  skipped (set PROD_HEALTH_API_BASE, VITE_API_URL, or pass --url <origin>)');
    report.sections.api = { skipped: true };
  } else if (isPlaceholderApiBase(base)) {
    log(`  skipped (placeholder URL: ${base} — set a real API origin)`);
    report.sections.api = { skipped: true, reason: 'placeholder_base' };
  } else {
    log(`  base: ${base}`);
    report.sections.api = { base };
    for (const path of [
      '/api/health',
      '/api/hot-matches?limit_count=5',
      '/api/live-pairings?limit=3',
      '/api/live-signals?limit=5',
      '/api/trending',
    ]) {
      const r = await httpGet(base, path);
      const label = path.split('?')[0];
      let detail = `HTTP ${r.status}`;
      if (r.body && typeof r.body === 'object') {
        if (label === '/api/health') detail = `status=${r.body.status ?? '?'}`;
        if (label === '/api/hot-matches')
          detail = `matches=${(r.body.matches || []).length}`;
        if (label === '/api/live-pairings') detail = `array_len=${Array.isArray(r.body) ? r.body.length : 'obj'}`;
        if (label === '/api/live-signals')
          detail = `signals=${(r.body.signals || []).length}`;
        if (label === '/api/trending') detail = `keys=${Object.keys(r.body).slice(0, 4).join(',')}`;
      } else if (!r.ok && r.error) detail = r.error;
      log(`  ${path} → ${detail}`);
      report.sections.api[path] = { status: r.status, ok: r.ok };
      if (!r.ok) report.warnings.push(`${path} HTTP ${r.status} ${r.error || ''}`);
      if (r.ok && path.startsWith('/api/hot-matches') && (r.body?.matches || []).length === 0) {
        report.warnings.push('hot-matches returned empty array');
      }
      if (r.ok && path.startsWith('/api/live-signals') && (r.body?.signals || []).length === 0) {
        report.warnings.push('live-signals returned empty array');
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  report.elapsedSeconds = Number(elapsed);
  report.warnings = [...new Set(report.warnings)];
  report.failures = [...new Set(report.failures)];

  section('Summary');
  const failN = report.failures.length;
  const warnN = report.warnings.length;
  const overall = failN > 0 ? 'FAIL' : warnN > 0 ? 'WARN' : 'PASS';
  report.overall = overall;

  log(`  Overall: ${overall}`);
  log(`  Failures: ${failN} · Warnings: ${warnN} · Time: ${elapsed}s`);
  if (report.warnings.length && !JSON_MODE) {
    log('\n  Warnings:');
    report.warnings.forEach((w) => log(`    · ${w}`));
  }
  if (report.failures.length && !JSON_MODE) {
    log('\n  Failures:');
    report.failures.forEach((w) => log(`    · ${w}`));
  }
  log('\n═══════════════════════════════════════════════════════════════\n');

  if (JSON_MODE) console.log(JSON.stringify(report, null, 2));

  process.exit(failN > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Pipeline audit failed:', e.message);
  process.exit(1);
});
