#!/usr/bin/env node
/**
 * Backfill immutable served Hit@5 prediction snapshots.
 *
 * For each serve-grade startup with enough suggested matches and no
 * cohort_key=served-first-top5 rows yet, freeze a firm-deduped top-5.
 *
 * Usage:
 *   node scripts/backfill-served-prediction-snapshots.mjs
 *   node scripts/backfill-served-prediction-snapshots.mjs --apply --limit=200
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { isServeGradeStartupIdentity } = require('../server/lib/fundingEvidenceLedger.js');
const {
  freezeTopFiveIfAbsent,
  SERVED_COHORT_KEY,
} = require('../server/lib/freezeFundingPredictionSnapshot.js');

const apply = process.argv.includes('--apply');
const limit = Math.min(
  Math.max(Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 100), 1),
  1000,
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
  const pool = new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 1,
  });
  const { rows: candidates } = await pool.query(
    `
    SELECT su.id, su.name, su.website, su.company_domain, su.source_type, su.description,
           su.entity_gate, su.total_god_score,
           count(m.*)::int AS match_n
    FROM startup_uploads su
    JOIN startup_investor_matches m
      ON m.startup_id = su.id AND m.status = 'suggested'
    WHERE su.status = 'approved'
      AND su.entity_gate = 'qualified'
      AND su.source_type = 'url'
      AND su.website IS NOT NULL
      AND length(coalesce(su.description, '')) >= 40
      AND NOT EXISTS (
        SELECT 1 FROM funding_prediction_snapshots s
        WHERE s.startup_id = su.id AND s.cohort_key = $1
      )
    GROUP BY su.id
    HAVING count(m.*) >= 10
    ORDER BY su.total_god_score DESC NULLS LAST, count(m.*) DESC
    LIMIT $2
    `,
    [SERVED_COHORT_KEY, Math.max(limit * 3, 100)],
  );
  await pool.end();

  const eligible = candidates.filter((row) => isServeGradeStartupIdentity(row)).slice(0, limit);
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    cohort_key: SERVED_COHORT_KEY,
    candidates_scanned: candidates.length,
    serve_grade_eligible: eligible.length,
    frozen: 0,
    skipped: {},
    preview: [],
  };

  for (const startup of eligible) {
    if (!apply) {
      summary.preview.push({
        startup: startup.name,
        match_n: startup.match_n,
        god: startup.total_god_score,
      });
      continue;
    }
    const result = await freezeTopFiveIfAbsent({
      supabase: db,
      startupId: startup.id,
      predictionKind: 'served_impression',
      modelVersionFallback: 'backfill-served-v1',
    });
    if (result.frozen) {
      summary.frozen += 1;
      summary.preview.push({
        startup: startup.name,
        predicted_at: result.predicted_at,
        match_n: startup.match_n,
      });
    } else {
      const reason = result.reason || 'unknown';
      summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
    }
  }

  if (!apply) {
    summary.preview = summary.preview.slice(0, 25);
    summary.note = 'Pass --apply to freeze. Idempotent via ignoreDuplicates / already_frozen.';
  } else {
    summary.preview = summary.preview.slice(0, 25);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
