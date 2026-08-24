#!/usr/bin/env node
/**
 * Release funding_evidence_search_queue rows stuck in `processing` (crashed mid-search).
 *
 * Usage:
 *   node scripts/release-stuck-funding-search-queue.mjs
 *   node scripts/release-stuck-funding-search-queue.mjs --apply
 *   node scripts/release-stuck-funding-search-queue.mjs --apply --minutes=30
 */
import 'dotenv/config';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const minutes = Math.max(
  5,
  Number(process.argv.find((a) => a.startsWith('--minutes='))?.split('=')[1] || 30),
);

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');

  const pool = new pg.Pool({ connectionString: massageConnectionString(url), max: 1 });

  const { rows: stuck } = await pool.query(
    `
    SELECT q.startup_id, s.name, q.attempts, q.updated_at, q.error_message
    FROM funding_evidence_search_queue q
    JOIN startup_uploads s ON s.id = q.startup_id
    WHERE q.status = 'processing'
      AND q.updated_at < now() - ($1::text || ' minutes')::interval
    ORDER BY q.updated_at
    `,
    [minutes],
  );

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      stale_minutes: minutes,
      stuck_count: stuck.length,
      rows: stuck,
    }, null, 2));
    await pool.end();
    return;
  }

  const { rows: released } = await pool.query(
    `
    UPDATE funding_evidence_search_queue q
    SET status = 'pending',
        error_message = 'cleanup:released_stuck_processing',
        updated_at = now()
    WHERE q.status = 'processing'
      AND q.updated_at < now() - ($1::text || ' minutes')::interval
    RETURNING startup_id
    `,
    [minutes],
  );

  console.log(JSON.stringify({
    mode: 'apply',
    stale_minutes: minutes,
    released_count: released.length,
    startup_ids: released.map((r) => r.startup_id),
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
