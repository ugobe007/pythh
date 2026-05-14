#!/usr/bin/env node
/**
 * Read-only snapshot of startup_uploads — status totals, RSS vs rest, rejected-note buckets,
 * pending URL gaps. No writes.
 *
 *   node scripts/report-startup-uploads-queue.js
 *   node scripts/report-startup-uploads-queue.js --csv=pending_snapshot.csv   # pending rows only
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const csvArg = argv.find((a) => a.startsWith('--csv='));
const CSV_PATH = csvArg ? csvArg.split('=').slice(1).join('=') : null;

const STATUSES = [
  'pending',
  'approved',
  'rejected',
  'reviewing',
  'holding',
  'pending_enrichment',
  'archived',
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const PLACEHOLDER_WEB = new Set(['n/a', 'na', 'none', 'null', 'tbd', '-', '.', '..', 'unknown']);

function webTrim(s) {
  return String(s || '').trim();
}

function isPlaceholderWeb(s) {
  const t = webTrim(s).toLowerCase();
  return t.length === 0 || PLACEHOLDER_WEB.has(t);
}

function looksLikeDomainOrUrl(s) {
  const t = webTrim(s);
  if (t.length < 4 || isPlaceholderWeb(t)) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^ftp:\/\//i.test(t)) return true;
  if (/^www\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  return false;
}

function hasWebPresence(row) {
  return (
    looksLikeDomainOrUrl(row.website) ||
    looksLikeDomainOrUrl(row.company_website) ||
    looksLikeDomainOrUrl(row.source_url)
  );
}

function bucketRejectedNote(note) {
  const n = (note || '').toLowerCase();
  if (!n.trim()) return '(empty admin_notes)';
  if (n.includes('auto-triage')) return 'auto-triage (legacy script)';
  if (n.includes('quality-gate')) return 'quality_gate.js';
  if (n.includes('purge') && n.includes('pending')) return 'purge-pending-startups-pipeline';
  if (n.includes('bulk-auto-review') && n.includes('reject')) return 'bulk-auto-review reject';
  if (n.includes('bulk-auto-review') && n.includes('approve')) return 'bulk-auto-review approve note on reject?';
  if (n.includes('no http') || n.includes('no usable website')) return 'reject: no website / URL note';
  if (n.includes('isgarbage') || n.includes('garbage')) return 'reject: garbage / name';
  if (n.includes('junk_gate') || n.includes('entity_gate=junk')) return 'reject: entity_gate junk';
  if (n.includes('total_god_score')) return 'reject: GOD threshold';
  return 'other / manual';
}

async function countExact(filter) {
  let q = sb.from('startup_uploads').select('*', { count: 'exact', head: true });
  if (filter?.status) q = q.eq('status', filter.status);
  if (filter?.source_type) q = q.eq('source_type', filter.source_type);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function aggregateRejectedNotes() {
  const buckets = {};
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id, admin_notes')
      .eq('status', 'rejected')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      const k = bucketRejectedNote(row.admin_notes);
      buckets[k] = (buckets[k] || 0) + 1;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return buckets;
}

async function pendingUrlStats() {
  let withWeb = 0;
  let without = 0;
  const PAGE = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id, name, website, company_website, source_url, total_god_score, source_type')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      if (hasWebPresence(row)) withWeb += 1;
      else without += 1;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { withWeb, without, total: withWeb + without };
}

async function exportPendingCsv(outPath) {
  const rows = [];
  const PAGE = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select(
        'id, name, status, source_type, total_god_score, entity_gate, website, company_website, source_url, submitted_email, created_at, admin_notes'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = [
    'id',
    'name',
    'source_type',
    'total_god_score',
    'entity_gate',
    'website',
    'company_website',
    'source_url',
    'has_web_presence',
    'submitted_email',
    'created_at',
    'admin_notes',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.name,
        r.source_type,
        r.total_god_score,
        r.entity_gate,
        r.website,
        r.company_website,
        r.source_url,
        hasWebPresence(r) ? 'yes' : 'no',
        r.submitted_email,
        r.created_at,
        r.admin_notes,
      ]
        .map(esc)
        .join(',')
    );
  }
  const abs = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, lines.join('\n'), 'utf8');
  return { path: abs, rows: rows.length };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  STARTUP_UPLOADS QUEUE REPORT (read-only)');
  console.log('══════════════════════════════════════════════════════════════\n');

  const byStatus = {};
  let totalAll = 0;
  for (const st of STATUSES) {
    const c = await countExact({ status: st });
    byStatus[st] = c;
    totalAll += c;
  }
  const unknownStatus = await countExact({});
  const orphans = Math.max(0, unknownStatus - totalAll);

  console.log('── Counts by status ──');
  for (const st of STATUSES) {
    console.log(`  ${st.padEnd(22)} ${String(byStatus[st] || 0).padStart(8)}`);
  }
  console.log(`  ${'TOTAL (sum above)'.padEnd(22)} ${String(totalAll).padStart(8)}`);
  console.log(`  ${'ALL ROWS (table)'.padEnd(22)} ${String(unknownStatus).padStart(8)}`);
  if (orphans > 0) console.log(`  (non-listed statuses: ${orphans})`);

  console.log('\n── RSS source_type = rss ──');
  let rssTotal = null;
  try {
    rssTotal = await countExact({ source_type: 'rss' });
    console.log(`  rss rows (all statuses): ${rssTotal}`);
    for (const st of STATUSES) {
      const { count, error } = await sb
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', 'rss')
        .eq('status', st);
      if (error) throw new Error(error.message);
      console.log(`    ${st.padEnd(20)} ${count || 0}`);
    }
  } catch (e) {
    if (String(e.message).includes('source_type')) {
      console.log('  (source_type column missing — skipped)');
      rssTotal = null;
    } else throw e;
  }

  console.log('\n── Rejected rows: admin_notes bucket (how they left pending) ──');
  const rejBuckets = await aggregateRejectedNotes();
  const rejTotal = Object.values(rejBuckets).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(rejBuckets).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted) {
    console.log(`  ${String(v).padStart(6)}  ${k}`);
  }
  console.log(`  ${'—'.repeat(40)}\n  ${String(rejTotal).padStart(6)}  rejected total (sampled all)`);

  console.log('\n── Pending rows: URL presence (same rules as bulk-auto-review) ──');
  const purl = await pendingUrlStats();
  console.log(`  pending total:     ${purl.total}`);
  console.log(`  with web signal:   ${purl.withWeb}`);
  console.log(`  no URL signal:     ${purl.without}`);

  const report = {
    generated_at: new Date().toISOString(),
    by_status: byStatus,
    table_total: unknownStatus,
    rss_total: rssTotal,
    rejected_note_buckets: rejBuckets,
    pending_url: purl,
  };

  const outDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `startup-queue-${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n── Wrote JSON ──\n  ${jsonPath}`);

  if (CSV_PATH) {
    const { path: csvOut, rows } = await exportPendingCsv(CSV_PATH);
    console.log(`\n── Wrote pending CSV (${rows} rows) ──\n  ${csvOut}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
