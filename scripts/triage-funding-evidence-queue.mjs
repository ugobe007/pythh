#!/usr/bin/env node
/**
 * Triage funding_evidence_search_queue so continual reconciliation
 * drains real startups first toward a 5000-startup resolved cohort.
 *
 * Resolved = queue status complete|error OR has verified match evidence
 * Cohort = approved + entity_gate=qualified + source_type=url + website present
 *
 * Usage:
 *   npm run outcomes:triage-queue
 *   npm run outcomes:triage-queue -- --apply
 *   npm run outcomes:triage-queue -- --apply --park-weak
 */
import 'dotenv/config';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const parkWeak = process.argv.includes('--park-weak') || apply; // default on with --apply
const TARGET = Math.max(
  100,
  Number(process.argv.find((a) => a.startsWith('--target='))?.split('=')[1] || 5000),
);

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  target: TARGET,
  boosted_qualified_url: 0,
  parked_weak: 0,
  skipped_junk: 0,
  scrubbed_alchemist_firm: 0,
  progress: null,
};

if (apply) {
  // 1) Boost qualified+url pending to front of the line
  const boost = await pool.query(`
    UPDATE funding_evidence_search_queue q
    SET priority = GREATEST(coalesce(q.priority, 0), 20000) + LEAST(coalesce(s.total_god_score, 0)::int, 100),
        updated_at = now(),
        error_message = coalesce(nullif(q.error_message, ''), 'triage:boost_qualified_url')
    FROM startup_uploads s
    WHERE q.startup_id = s.id
      AND q.status = 'pending'
      AND s.status = 'approved'
      AND s.entity_gate = 'qualified'
      AND s.source_type = 'url'
      AND coalesce(s.website, '') <> ''
  `);
  summary.boosted_qualified_url = boost.rowCount || 0;

  if (parkWeak) {
    // 2) Park weak identities so they don't consume agent batches
    const park = await pool.query(`
      UPDATE funding_evidence_search_queue q
      SET priority = LEAST(coalesce(q.priority, 0), 0),
          updated_at = now(),
          error_message = 'triage:parked_weak_identity'
      FROM startup_uploads s
      WHERE q.startup_id = s.id
        AND q.status = 'pending'
        AND (
          s.entity_gate IN ('needs_url', 'junk')
          OR s.entity_gate IS NULL
          OR s.source_type IS DISTINCT FROM 'url'
          OR coalesce(s.website, '') = ''
        )
    `);
    summary.parked_weak = park.rowCount || 0;

    // 3) Hard-skip junk pending (mark complete, no search)
    const junk = await pool.query(`
      UPDATE funding_evidence_search_queue q
      SET status = 'complete',
          result_count = 0,
          last_searched_at = now(),
          updated_at = now(),
          error_message = 'triage:skipped_junk_entity_gate'
      FROM startup_uploads s
      WHERE q.startup_id = s.id
        AND q.status IN ('pending', 'error')
        AND s.entity_gate = 'junk'
    `);
    summary.skipped_junk = junk.rowCount || 0;
  }

  // 4) Fix known investor firm pollution (Alchemist Accelerator ≠ Accel)
  const scrub = await pool.query(`
    UPDATE investors
    SET firm = name,
        updated_at = now()
    WHERE name ILIKE 'Alchemist Accelerator'
      AND firm ILIKE 'Accel%'
      AND firm IS DISTINCT FROM name
  `);
  summary.scrubbed_alchemist_firm = scrub.rowCount || 0;
}

const { rows: progressRows } = await pool.query(`
  WITH cohort AS (
    SELECT s.id
    FROM startup_uploads s
    WHERE s.status = 'approved'
      AND s.entity_gate = 'qualified'
      AND s.source_type = 'url'
      AND coalesce(s.website, '') <> ''
      AND EXISTS (SELECT 1 FROM startup_investor_matches m WHERE m.startup_id = s.id)
  ),
  resolved AS (
    SELECT c.id
    FROM cohort c
    WHERE EXISTS (
      SELECT 1 FROM funding_evidence_search_queue q
      WHERE q.startup_id = c.id AND q.status IN ('complete', 'error')
    )
    OR EXISTS (
      SELECT 1 FROM match_validation_evidence e
      WHERE e.startup_id = c.id AND e.verified
    )
  )
  SELECT
    (SELECT count(*)::int FROM cohort) AS cohort_size,
    (SELECT count(*)::int FROM resolved) AS resolved_count,
    (
      SELECT count(*)::int FROM funding_evidence_search_queue q
      JOIN startup_uploads s ON s.id = q.startup_id
      WHERE q.status = 'pending'
        AND s.entity_gate = 'qualified'
        AND s.source_type = 'url'
        AND coalesce(s.website, '') <> ''
        AND coalesce(q.priority, 0) >= 20000
    ) AS pending_boosted,
    (
      SELECT count(*)::int FROM match_validation_evidence e
      JOIN startup_investor_matches m ON m.id = e.match_id
      WHERE e.verified AND e.event_at > m.created_at
    ) AS verified_pairs
`);

const progress = progressRows[0];
summary.progress = {
  ...progress,
  target: TARGET,
  remaining: Math.max(0, TARGET - Number(progress.resolved_count || 0)),
  pct: Number(((100 * Number(progress.resolved_count || 0)) / TARGET).toFixed(1)),
};

await pool.end();
console.log(JSON.stringify(summary, null, 2));
