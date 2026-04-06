#!/usr/bin/env node
/**
 * Data quality rollup — runs existing scripts and merges output for cron / humans.
 *
 * Usage:
 *   node scripts/data-quality-report.js
 *   node scripts/data-quality-report.js --json > /tmp/dq.json
 *   node scripts/data-quality-report.js --json --quick   # + dq:coverage, dq:self-signals:aligned, ontology export, tagline dry-run
 *   node scripts/data-quality-report.js --no-shell   # only in-process JSON (enrichment + RSS measure)
 *   node scripts/data-quality-report.js --json --no-dq-extended   # skip coverage / self-signals / ontology / tagline
 *   node scripts/data-quality-report.js --json --ontology-limit=0
 *   node scripts/data-quality-report.js --json --tagline-apply   # tagline backfill with --apply (destructive)
 *
 * Does not write to DB (except --tagline-apply). Pair with PM2 or scripts/cron/dq-report-scheduler.js.
 */

'use strict';

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const NO_SHELL = argv.includes('--no-shell');
const QUICK = argv.includes('--quick');
const NO_DQ_EXTENDED = argv.includes('--no-dq-extended');
const TAGLINE_APPLY = argv.includes('--tagline-apply');

function argNum(name, fallback) {
  const p = argv.find((a) => a.startsWith(`${name}=`));
  if (!p) return fallback;
  const v = parseInt(p.slice(name.length + 1), 10);
  return Number.isFinite(v) ? v : fallback;
}

const ONTOLOGY_LIMIT = argNum('--ontology-limit', 300);
const TAGLINE_SCAN_LIMIT = argNum('--tagline-candidate-limit', 500);

function runNode(script, args = []) {
  return execFileSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
    env: process.env,
  }).trim();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return { parse_error: true, raw: s.slice(0, 500) };
  }
}

/** Prefer whole-string parse; fall back to outermost { … } if something else printed to stdout. */
function parseJsonFromProcessOutput(s) {
  const t = s.trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) return { parse_error: true, raw: t.slice(0, 800) };
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      return { parse_error: true, raw: t.slice(0, 800) };
    }
  }
}

function runDqExtended(report) {
  if (NO_DQ_EXTENDED) return;

  try {
    const raw = runNode('scripts/report-card-data-coverage.js', ['--json']);
    report.coverage = parseJsonFromProcessOutput(raw);
  } catch (e) {
    report.coverage = { error: e.message };
  }

  try {
    const raw = runNode('scripts/report-startup-self-description-signals.js', [
      '--json',
      '--source=tagline-only',
      '--structured-cohort=tagline',
      '--lexical-filter=boilerplate',
    ]);
    report.self_signals = parseJsonFromProcessOutput(raw);
    report.self_signals_variant = 'dq:self-signals:aligned';
  } catch (e) {
    report.self_signals = { error: e.message };
  }

  if (ONTOLOGY_LIMIT > 0) {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const rel = path.join('reports', `ontology-labeling-sample-${day}.jsonl`);
      const outAbs = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      runNode('scripts/export-ontology-labeling-sample.js', [
        `--out=${outAbs}`,
        `--limit=${ONTOLOGY_LIMIT}`,
      ]);
      const st = fs.statSync(outAbs);
      const text = fs.readFileSync(outAbs, 'utf8');
      const rows = text.split('\n').filter((line) => line.trim()).length;
      report.ontology_export = {
        path: rel,
        bytes: st.size,
        rows_written: rows,
        limit: ONTOLOGY_LIMIT,
      };
    } catch (e) {
      report.ontology_export = { error: e.message };
    }
  } else {
    report.ontology_export = { skipped: true, reason: '--ontology-limit=0' };
  }

  try {
    const tagArgs = [`--limit=${TAGLINE_SCAN_LIMIT}`];
    if (TAGLINE_APPLY) tagArgs.push('--apply');
    const tagOut = runNode('scripts/backfill-tagline-from-description.js', tagArgs);
    report.tagline_backfill = {
      mode: TAGLINE_APPLY ? 'apply' : 'dry_run',
      candidate_limit: TAGLINE_SCAN_LIMIT,
      stdout_excerpt: tagOut.slice(0, 6000),
    };
  } catch (e) {
    report.tagline_backfill = { error: e.message };
  }
}

async function main() {
  const report = {
    generated_at: new Date().toISOString(),
    enrichment: null,
    rss_source_quality_sample: null,
    shell: {},
    coverage: null,
    self_signals: null,
    ontology_export: null,
    tagline_backfill: null,
  };

  if (!NO_SHELL && !QUICK) {
    try {
      report.enrichment = safeJsonParse(runNode('scripts/print-enrichment-stats.js'));
    } catch (e) {
      report.enrichment = { error: e.message };
    }
    try {
      report.rss_source_quality_sample = safeJsonParse(
        runNode('scripts/measure-source-quality-impact.js', ['--days=14', '--limit=5000'])
      );
    } catch (e) {
      report.rss_source_quality_sample = { error: e.message };
    }
    runDqExtended(report);
    try {
      report.shell.data_integrity_stdout = runNode('scripts/data-integrity-check.js').slice(0, 12000);
    } catch (e) {
      report.shell.data_integrity_error = e.message;
    }
    try {
      report.shell.quality_gate_stdout = runNode('scripts/quality-gate.js').slice(0, 8000);
    } catch (e) {
      report.shell.quality_gate_error = e.message;
    }
    try {
      report.shell.audit_junk_stdout = runNode('scripts/audit-junk-entries.js').slice(0, 8000);
    } catch (e) {
      report.shell.audit_junk_error = e.message;
    }
    try {
      report.shell.investor_quality_stdout = runNode('scripts/check-investor-quality.js').slice(0, 12000);
    } catch (e) {
      report.shell.investor_quality_error = e.message;
    }
  } else if (QUICK && !NO_SHELL) {
    try {
      report.enrichment = safeJsonParse(runNode('scripts/print-enrichment-stats.js'));
    } catch (e) {
      report.enrichment = { error: e.message };
    }
    try {
      report.rss_source_quality_sample = safeJsonParse(
        runNode('scripts/measure-source-quality-impact.js', ['--days=14', '--limit=5000'])
      );
    } catch (e) {
      report.rss_source_quality_sample = { error: e.message };
    }
    runDqExtended(report);
    report.mode = 'quick';
  } else {
    const { getSupabaseClient, paginateStartupUploads } = require('../server/lib/supabaseClient');
    function startupRowNeedsEnrichment(r) {
      if (!r || !r.extracted_data) return true;
      const tier = r.extracted_data?.data_tier;
      if (tier === 'C') return true;
      if (tier !== 'A' && tier !== 'B') return true;
      if (typeof r.data_completeness === 'number' && r.data_completeness < 35) return true;
      return false;
    }
    const supabase = getSupabaseClient();
    const rows = await paginateStartupUploads(supabase, 'extracted_data, data_completeness, status', (q) => q);
    const byTier = { A: 0, B: 0, C: 0, unknown: 0 };
    const byStatus = {};
    let needs = 0;
    for (const r of rows) {
      const st = r.status || 'unknown';
      byStatus[st] = (byStatus[st] || 0) + 1;
      const tier = r.extracted_data?.data_tier;
      if (tier === 'A') byTier.A += 1;
      else if (tier === 'B') byTier.B += 1;
      else if (tier === 'C') byTier.C += 1;
      else byTier.unknown += 1;
      if (startupRowNeedsEnrichment(r)) needs += 1;
    }
    report.enrichment = {
      source: 'startup_uploads (inline)',
      total: rows.length,
      needs_enrichment: needs,
      by_tier: byTier,
      by_startup_status: byStatus,
    };
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { shouldProcessEvent } = require('../lib/source-quality-filter');
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: evs } = await sb
      .from('startup_events')
      .select('source_title, source_publisher')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(3000);
    const byReason = {};
    let kept = 0;
    let dropped = 0;
    for (const row of evs || []) {
      const r = shouldProcessEvent(row.source_title, row.source_publisher);
      if (r.keep) kept++;
      else {
        dropped++;
        byReason[r.reason] = (byReason[r.reason] || 0) + 1;
      }
    }
    const n = (evs || []).length || 1;
    report.rss_source_quality_sample = {
      days: 14,
      sample_size: (evs || []).length,
      kept,
      dropped,
      drop_rate: Math.round((dropped / n) * 1000) / 1000,
      dropped_by_reason: byReason,
    };
    runDqExtended(report);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n📋 DATA QUALITY REPORT');
  console.log('═'.repeat(60));
  console.log(`Generated: ${report.generated_at}\n`);
  if (report.enrichment) {
    console.log('── Enrichment (startup_uploads) ──');
    console.log(JSON.stringify(report.enrichment, null, 2));
  }
  if (report.rss_source_quality_sample) {
    console.log('\n── RSS source-quality (recent startup_events) ──');
    console.log(JSON.stringify(report.rss_source_quality_sample, null, 2));
  }
  if (report.coverage) {
    console.log('\n── Card + scoring coverage (dq:coverage) ──');
    console.log(JSON.stringify(report.coverage, null, 2).slice(0, 12000));
  }
  if (report.self_signals) {
    console.log('\n── Self-description signals (dq:self-signals:aligned) ──');
    console.log(JSON.stringify(report.self_signals, null, 2).slice(0, 12000));
  }
  if (report.ontology_export) {
    console.log('\n── Ontology labeling export (ontology:export-sample) ──');
    console.log(JSON.stringify(report.ontology_export, null, 2));
  }
  if (report.tagline_backfill) {
    console.log('\n── Tagline backfill (dry-run unless --tagline-apply) ──');
    console.log(JSON.stringify(report.tagline_backfill, null, 2).slice(0, 4000));
  }
  if (Object.keys(report.shell).length) {
    console.log('\n── Shell script excerpts (see full logs in CI) ──');
    for (const [k, v] of Object.entries(report.shell)) {
      console.log(`\n[${k}]\n${typeof v === 'string' ? v.slice(0, 2000) : v}`);
    }
  }
  console.log('\n' + '═'.repeat(60));
  console.log('Tip: node scripts/data-quality-report.js --json > dq-report.json\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
