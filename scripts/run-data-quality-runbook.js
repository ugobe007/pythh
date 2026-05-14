#!/usr/bin/env node
/**
 * Data quality runbook — Phases A, B, C
 *
 * 1) Runs scripts/sql/data_quality_runbook.sql against Postgres when DATABASE_URL is set
 *    (same connection pattern as server/db.js — Supabase session pooler or direct).
 * 2) Runs existing Node DQ helpers (no duplication of report-card-data-coverage.js):
 *      • scripts/print-enrichment-stats.js
 *      • scripts/measure-source-quality-impact.js --days=7
 * 3) Prints a pointer to deep card dimension coverage: npm run dq:coverage:json
 *
 * Usage:
 *   npm run dq:runbook
 *   npm run dq:runbook:json
 *   node scripts/run-data-quality-runbook.js --sql-only
 *   node scripts/run-data-quality-runbook.js --no-node-helpers
 *
 * Env:
 *   DATABASE_URL — required for SQL sections only (Supabase direct Postgres URI).
 *   This is independent of DQ_RUNBOOK_CHAIN_REPORT (that flag only chains data-quality-report.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'scripts', 'sql', 'data_quality_runbook.sql');

const argv = process.argv.slice(2);
const WANT_JSON = argv.includes('--json');
const SQL_ONLY = argv.includes('--sql-only');
const NO_NODE_HELPERS = argv.includes('--no-node-helpers');

function runNodeScript(rel, args = []) {
  const out = spawnSync(process.execPath, [path.join(ROOT, rel), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
  });
  if (out.status !== 0) {
    return { ok: false, stderr: out.stderr || out.stdout || 'exit ' + out.status };
  }
  return { ok: true, stdout: out.stdout || '' };
}

/** Child scripts may print dotenv banners before JSON — extract outermost `{ … }`. */
function parseJsonFromProcessOutput(s) {
  const t = (s || '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) {
      return { parse_error: true, raw: t.slice(0, 800) };
    }
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      return { parse_error: true, raw: t.slice(0, 800) };
    }
  }
}

/**
 * Node pg parses DATABASE_URL and merges parsed `ssl` over Pool options — `sslmode=require`
 * becomes `ssl: {}` and still verifies the chain (SELF_SIGNED_CERT_IN_CHAIN against pooler).
 * `sslmode=no-verify` sets rejectUnauthorized: false in pg-connection-string.
 *
 * Opt out of rewriting with DATABASE_SSL=false. Supabase hosts (*.supabase.com / .supabase.co)
 * get no-verify unless opted out.
 */
function massageConnectionStringForNodePg(connectionString) {
  const s = String(connectionString || '');
  const v = String(process.env.DATABASE_SSL || '').toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return s;

  const isSupabase = /supabase\.com/i.test(s) || /\.supabase\.co/i.test(s);
  const relax = v === 'true' || v === '1' || v === 'yes' || isSupabase;
  if (!relax) return s;

  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) {
    return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  }
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function splitSqlSections(sql) {
  const idx = sql.indexOf('-- ── Phase');
  if (idx === -1) {
    throw new Error('data_quality_runbook.sql: missing section markers (-- ── Phase)');
  }
  const rest = sql.slice(idx);
  const chunks = rest.split(/\n(?=-- ── Phase)/);
  return chunks.map((chunk) => {
    const lines = chunk.split('\n');
    const title = lines[0].replace(/^-- ──\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();
    return { title, body };
  });
}

async function runSqlRunbook() {
  const conn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!conn) {
    return {
      ok: false,
      error:
        'DATABASE_URL not set in this process — SQL sections skipped. Add to .env locally, or Fly secrets + ensure PM2 passes env (see ecosystem dq-runbook-scheduler). DQ_RUNBOOK_CHAIN_REPORT does not replace DATABASE_URL; it only adds a second JSON from data-quality-report.js.',
    };
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const sections = splitSqlSections(sql);
  const pool = new Pool({
    connectionString: massageConnectionStringForNodePg(conn),
    max: 1,
  });
  const results = [];

  try {
    await pool.query("SET statement_timeout = '120s'");
    for (const { title, body } of sections) {
      if (!body || /^--\s*$/m.test(body)) continue;
      try {
        const { rows, fields } = await pool.query(body);
        results.push({ section: title, rows, fields: fields?.map((f) => f.name) });
      } catch (e) {
        results.push({ section: title, error: e.message });
      }
    }
  } finally {
    await pool.end();
  }

  return { ok: true, results };
}

function printTable(rows, fields) {
  if (!rows || rows.length === 0) {
    console.log('  (no rows)');
    return;
  }
  const cols = fields || Object.keys(rows[0]);
  console.log('  ' + cols.join('\t'));
  for (const r of rows.slice(0, 50)) {
    console.log('  ' + cols.map((c) => String(r[c] ?? '').slice(0, 80)).join('\t'));
  }
  if (rows.length > 50) console.log(`  … ${rows.length - 50} more rows`);
}

async function main() {
  const report = {
    generated_at: new Date().toISOString(),
    sql_runbook: null,
    enrichment_stats: null,
    source_quality_7d: null,
    hints: [
      'Card + scoring dimension coverage (JS parity): npm run dq:coverage:json',
      'Full DQ rollup: npm run dq:report:json',
    ],
  };

  if (!SQL_ONLY && !NO_NODE_HELPERS) {
    const enr = runNodeScript('scripts/print-enrichment-stats.js');
    if (enr.ok) {
      report.enrichment_stats = parseJsonFromProcessOutput(enr.stdout);
    } else {
      report.enrichment_stats = { error: enr.stderr };
    }

    const meas = runNodeScript('scripts/measure-source-quality-impact.js', ['--days=7', '--limit=8000']);
    if (meas.ok) {
      report.source_quality_7d = parseJsonFromProcessOutput(meas.stdout);
    } else {
      report.source_quality_7d = { error: meas.stderr };
    }
  }

  report.sql_runbook = await runSqlRunbook();

  if (WANT_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!SQL_ONLY) {
    console.log('\n══ Data quality runbook ══');
    console.log(`Generated: ${report.generated_at}\n`);
    if (report.enrichment_stats) {
      console.log('── Phase A: enrichment (startup_uploads) ──');
      console.log(JSON.stringify(report.enrichment_stats, null, 2));
    }
    if (report.source_quality_7d) {
      console.log('\n── Phase A/B: RSS filter sample (startup_events, 7d) ──');
      console.log(JSON.stringify(report.source_quality_7d, null, 2));
    }
  }

  const sql = report.sql_runbook;
  if (sql.ok && sql.results) {
    console.log('\n── SQL runbook (direct Postgres) ──');
    for (const block of sql.results) {
      if (block.error) {
        console.log(`\n[${block.section}] ERROR: ${block.error}`);
        continue;
      }
      console.log(`\n[${block.section}]`);
      printTable(block.rows, block.fields);
    }
  } else {
    console.log('\n── SQL runbook ──');
    console.log(sql.error || JSON.stringify(sql));
  }

  if (!SQL_ONLY) {
    console.log('\n── Next steps ──');
    for (const h of report.hints) console.log(`  • ${h}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
