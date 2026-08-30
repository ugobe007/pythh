#!/usr/bin/env node
/**
 * Mark URL-submit rows whose website is a publisher article as entity_gate=junk.
 *
 * These headline scrapes (VentureBurn / PE Hub / FinTech Times / …) inflate the
 * proof cohort unmatched pool and starve real sealed hunts. Real company rows
 * with company domains (yardstik.com, breedr.ai, …) are left alone.
 *
 * Usage:
 *   npm run proof-cohort:mark-publisher-junk
 *   npm run proof-cohort:mark-publisher-junk:apply -- --since=2026-08-25
 */
import 'dotenv/config';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const since =
  process.argv.find((a) => a.startsWith('--since='))?.split('=')[1] || '2026-08-25';
const limit = Math.max(
  1,
  Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 200),
);

const PUBLISHER_RE =
  '(techcrunch\\.com|ventureburn\\.com|finsmes\\.com|pehub\\.com|thefintechtimes\\.com|medium\\.com|substack\\.com|crunchbase\\.com|pulse2\\.com|forbes\\.com|bloomberg\\.com|businessinsider\\.com|saastr\\.com|eu-startups\\.com|techinafrica\\.com|agfundernews\\.com)/';

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  const v = String(process.env.DATABASE_SSL || '').toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return s;
  const isSupabase = /supabase\.com/i.test(s) || /\.supabase\.co/i.test(s);
  if (!isSupabase && v !== 'true' && v !== '1' && v !== 'yes') return s;
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});

try {
  const { rows: candidates } = await pool.query(
    `
    SELECT s.id, s.name, LEFT(s.website, 90) AS website,
           COALESCE(s.total_god_score, 0) AS god,
           EXISTS (
             SELECT 1 FROM funding_prediction_snapshots f
             WHERE f.startup_id = s.id AND f.cohort_key = 'served-first-top5'
           ) AS sealed
    FROM startup_uploads s
    WHERE s.source_type = 'url'
      AND s.created_at >= $1::timestamptz
      AND s.status = 'approved'
      AND s.entity_gate IS DISTINCT FROM 'junk'
      AND s.website ~* $2
    ORDER BY COALESCE(s.total_god_score, 0) DESC NULLS LAST
    LIMIT $3
    `,
    [since, PUBLISHER_RE, limit],
  );

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        since,
        candidates: candidates.length,
        sealed_among_them: candidates.filter((r) => r.sealed).length,
        sample: candidates.slice(0, 15).map((r) => ({
          name: r.name,
          god: r.god,
          sealed: r.sealed,
          website: r.website,
        })),
      },
      null,
      2,
    ),
  );

  if (!APPLY || candidates.length === 0) {
    process.exit(0);
  }

  const ids = candidates.map((r) => r.id);
  const now = new Date().toISOString();
  const { rowCount } = await pool.query(
    `
    UPDATE startup_uploads
    SET entity_gate = 'junk',
        entity_gate_reason = 'publisher_scrape_website',
        entity_gate_at = $2::timestamptz,
        updated_at = $2::timestamptz
    WHERE id = ANY($1::uuid[])
      AND entity_gate IS DISTINCT FROM 'junk'
    `,
    [ids, now],
  );

  // Drop search priority so junk stops winning the queue.
  await pool.query(
    `
    UPDATE funding_evidence_search_queue q
    SET priority = 0, status = 'complete', updated_at = NOW()
    WHERE q.startup_id = ANY($1::uuid[])
    `,
    [ids],
  );

  console.log(JSON.stringify({ marked_junk: rowCount, queue_cleared: ids.length }, null, 2));
} finally {
  await pool.end();
}
