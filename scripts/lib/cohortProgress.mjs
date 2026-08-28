/**
 * Shared cohort progress for match-outcome / resolution-loop agents.
 * Target: 5000 qualified+url startups with search complete or verified evidence.
 */
import pg from 'pg';

export const RESOLUTION_TARGET = 5000;

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

/**
 * @param {{ target?: number, databaseUrl?: string }} [opts]
 * @returns {Promise<null | {
 *   target: number,
 *   cohort_size: number,
 *   resolved_count: number,
 *   remaining: number,
 *   pct: number,
 *   verified_pairs: number,
 * }>}
 */
export async function fetchCohortProgress(opts = {}) {
  const target = opts.target ?? RESOLUTION_TARGET;
  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  const pool = new pg.Pool({
    connectionString: massageConnectionString(databaseUrl),
    max: 1,
  });
  try {
    const { rows } = await pool.query(`
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
        SELECT c.id FROM cohort c
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
          SELECT count(*)::int FROM match_validation_evidence e
          JOIN startup_investor_matches m ON m.id = e.match_id
          WHERE e.verified AND e.event_at > m.created_at
        ) AS verified_pairs
    `);
    const row = rows[0] || {};
    const resolvedCount = Number(row.resolved_count || 0);
    return {
      target,
      cohort_size: row.cohort_size,
      resolved_count: resolvedCount,
      remaining: Math.max(0, target - resolvedCount),
      pct: Number(((100 * resolvedCount) / target).toFixed(1)),
      verified_pairs: row.verified_pairs,
    };
  } finally {
    await pool.end();
  }
}
