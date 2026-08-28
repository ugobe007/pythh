#!/usr/bin/env node
/**
 * Backfill proof-cohort instrumentation: entity_gate + queue + Hit@5 seal.
 *
 * Repairs matched URL submits that never got enqueue/freeze because BG Phase 3
 * was skipped or fire-and-forget enqueue dropped on request teardown.
 *
 * Usage:
 *   node scripts/instrument-proof-cohort.mjs --since=2026-08-25
 *   node scripts/instrument-proof-cohort.mjs --since=2026-08-25 --apply --limit=100
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { instrumentMatchOutcomes } = require('../server/lib/instrumentMatchOutcomes.js');
const { isServeGradeStartupIdentity } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const sinceIso = sinceArg?.split('=')[1] || process.env.PROOF_COHORT_SINCE || '2026-08-25';
const limit = Math.min(
  Math.max(Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 200), 1),
  2000,
);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');

const db = createClient(url, key, { auth: { persistSession: false } });

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

async function main() {
  const sinceDate = new Date(sinceIso);
  if (Number.isNaN(sinceDate.getTime())) throw new Error('Invalid --since');
  const sinceTs = sinceDate.toISOString();

  const pool = new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 1,
  });

  const { rows: candidates } = await pool.query(
    `
    SELECT s.id, s.name, s.website, s.company_domain, s.source_type, s.entity_gate,
           s.status, s.description, s.total_god_score,
           count(m.*)::int AS match_n,
           EXISTS (
             SELECT 1 FROM funding_prediction_snapshots fps
             WHERE fps.startup_id = s.id AND fps.cohort_key = 'served-first-top5'
           ) AS has_snapshot,
           EXISTS (
             SELECT 1 FROM funding_evidence_search_queue q WHERE q.startup_id = s.id
           ) AS in_queue
    FROM startup_uploads s
    JOIN startup_investor_matches m
      ON m.startup_id = s.id AND m.status = 'suggested'
    WHERE s.status = 'approved'
      AND s.source_type = 'url'
      AND coalesce(s.website, '') <> ''
      AND s.entity_gate IS DISTINCT FROM 'junk'
      AND s.created_at >= $1::timestamptz
    GROUP BY s.id
    HAVING count(m.*) >= 5
    ORDER BY
      (EXISTS (
         SELECT 1 FROM funding_prediction_snapshots fps
         WHERE fps.startup_id = s.id AND fps.cohort_key = 'served-first-top5'
       )) ASC,
      (EXISTS (
         SELECT 1 FROM funding_evidence_search_queue q WHERE q.startup_id = s.id
       )) ASC,
      s.created_at DESC
    LIMIT $2
    `,
    [sinceTs, limit],
  );

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    since: sinceTs.split('T')[0],
    candidates: candidates.length,
    gate_set_qualified: 0,
    instrumented: 0,
    frozen: 0,
    already_frozen: 0,
    enqueue_ok: 0,
    skipped_freeze: {},
    serve_grade: 0,
    preview: [],
  };

  for (const row of candidates) {
    const serveGrade = isServeGradeStartupIdentity(row);
    if (serveGrade) summary.serve_grade += 1;

    const preview = {
      name: row.name,
      match_n: row.match_n,
      serve_grade: serveGrade,
      had_snapshot: row.has_snapshot,
      had_queue: row.in_queue,
      entity_gate: row.entity_gate,
    };

    if (!apply) {
      summary.preview.push(preview);
      continue;
    }

    if (row.entity_gate == null) {
      const { error: gateErr } = await db
        .from('startup_uploads')
        .update({ entity_gate: 'qualified' })
        .eq('id', row.id)
        .is('entity_gate', null);
      if (!gateErr) summary.gate_set_qualified += 1;
    }

    const result = await instrumentMatchOutcomes(db, row.id, {
      source: 'proof_cohort_backfill',
      modelVersionFallback: 'proof-cohort-backfill-v1',
    });
    summary.instrumented += 1;
    if (result.enqueue?.ok) summary.enqueue_ok += 1;
    if (result.freeze?.frozen) summary.frozen += 1;
    else if (result.freeze?.reason === 'already_frozen') summary.already_frozen += 1;
    else {
      const reason = result.freeze?.reason || 'unknown';
      summary.skipped_freeze[reason] = (summary.skipped_freeze[reason] || 0) + 1;
    }
    summary.preview.push({
      ...preview,
      freeze: result.freeze?.reason || (result.freeze?.frozen ? 'frozen' : null),
      enqueue_ok: result.enqueue?.ok,
    });
  }

  await pool.end();
  summary.preview = summary.preview.slice(0, 30);
  if (!apply) {
    summary.note = 'Pass --apply to set entity_gate=qualified (when null), enqueue, and freeze.';
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
