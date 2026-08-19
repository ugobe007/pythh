#!/usr/bin/env node
/**
 * Review pending match_validation_evidence rows (verify / reject).
 * Positives in historical_match_validation_dataset require verified=true.
 *
 * Usage:
 *   npm run outcomes:review -- --list
 *   npm run outcomes:review -- --apply --verify --limit=10
 *   npm run outcomes:review -- --apply --reject --id=<evidence-uuid> --note="duplicate"
 *
 * Env: PYTHH_REVIEWER_USER_ID (auth.users uuid). Defaults to ugobe07@gmail.com lookup.
 */
import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const listOnly = process.argv.includes('--list');
const verify = process.argv.includes('--verify');
const reject = process.argv.includes('--reject');
const limit = Math.max(
  1,
  Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 25),
);
const idArg = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];
const noteArg = process.argv.find((a) => a.startsWith('--note='))?.split('=').slice(1).join('=');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service environment');

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

async function resolveReviewerId() {
  if (process.env.PYTHH_REVIEWER_USER_ID) return process.env.PYTHH_REVIEWER_USER_ID;
  const email = process.env.OWNER_EMAILS?.split(',')[0]?.trim() || 'ugobe07@gmail.com';
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required to resolve reviewer uuid');
  const pool = new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 1,
  });
  try {
    const { rows } = await pool.query('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [email]);
    if (!rows[0]?.id) throw new Error(`No auth.users row for ${email} — set PYTHH_REVIEWER_USER_ID`);
    return rows[0].id;
  } finally {
    await pool.end();
  }
}

const db = createClient(url, key, { auth: { persistSession: false } });

const listSql = `
  SELECT e.id, su.name AS startup, i.name AS investor, e.evidence_type,
         e.event_at, m.created_at AS match_at,
         round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
         e.source_provider, left(e.source_url, 100) AS source_url, e.review_status
  FROM match_validation_evidence e
  JOIN startup_investor_matches m ON m.id = e.match_id
  JOIN startup_uploads su ON su.id = e.startup_id
  JOIN investors i ON i.id = e.investor_id
  WHERE e.review_status = 'pending' AND e.event_at > m.created_at
  ORDER BY e.event_at DESC
  LIMIT $1
`;

if (listOnly || (!apply && !verify && !reject)) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for --list');
  const pool = new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 1,
  });
  const { rows } = await pool.query(listSql, [limit]);
  await pool.end();
  console.log(JSON.stringify({ pending: rows.length, rows }, null, 2));
  process.exit(0);
}

if (!verify && !reject) throw new Error('Use --verify or --reject with --apply');
if (verify && reject) throw new Error('Use only one of --verify or --reject');

const decision = verify ? 'verified' : 'rejected';
const reviewer = await resolveReviewerId();

let ids = idArg ? [idArg] : [];
if (!ids.length) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const pool = new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 1,
  });
  const { rows } = await pool.query(
    `SELECT e.id FROM match_validation_evidence e
     JOIN startup_investor_matches m ON m.id = e.match_id
     WHERE e.review_status = 'pending' AND e.event_at > m.created_at
     ORDER BY e.event_at DESC LIMIT $1`,
    [limit],
  );
  await pool.end();
  ids = rows.map((r) => r.id);
}

const results = [];
for (const evidenceId of ids) {
  if (!apply) {
    results.push({ evidenceId, decision, mode: 'dry-run' });
    continue;
  }
  const { data, error } = await db.rpc('review_match_validation_evidence', {
    p_evidence_id: evidenceId,
    p_decision: decision,
    p_reviewer: reviewer,
    p_note: noteArg || null,
  });
  if (error) results.push({ evidenceId, error: error.message });
  else {
    results.push({
      evidenceId,
      ok: true,
      startup_id: data.startup_id,
      investor_id: data.investor_id,
      verified: data.verified,
    });
    await db.rpc('refresh_startup_match_outcome_classifications', {
      p_startup_id: data.startup_id,
    });
  }
}

console.log(
  JSON.stringify(
    { mode: apply ? 'apply' : 'dry-run', decision, reviewer, processed: results.length, results },
    null,
    2,
  ),
);
