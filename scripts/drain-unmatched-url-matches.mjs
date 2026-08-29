#!/usr/bin/env node
/**
 * Drain unmatched URL startups that still have no startup_investor_matches.
 *
 * Proof-cohort near-miss (Deep Cogito): company entered ~19m before a raise but
 * sat at 0 matches while EnhancedMatching / investor cache were broken or capped.
 * This script is the recovery + SLA lever — match within minutes, full pool.
 *
 * Usage:
 *   npm run proof-cohort:drain-unmatched -- --since=2026-08-25 --min-god=80
 *   npm run proof-cohort:drain-unmatched:apply -- --since=2026-08-25 --min-god=80 --limit=25
 *
 * Requires latest main (PR #78). If npm says "Missing script", run: git pull origin main
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';

const require = createRequire(import.meta.url);
const { EnhancedMatchingService } = require('../server/services/EnhancedMatchingService.js');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`proof-cohort:drain-unmatched — match high-GOD URL startups with 0 matches

Usage:
  npm run proof-cohort:drain-unmatched -- --since=2026-08-25 --min-god=80
  npm run proof-cohort:drain-unmatched:apply -- --since=2026-08-25 --min-god=80 --limit=25

Flags:
  --apply              write matches (default dry-run)
  --since=YYYY-MM-DD   cohort start (default 2026-08-25)
  --min-god=N          minimum total_god_score (default 70)
  --limit=N            max startups to process (default 25)
  --max-matches=N      matches to persist per startup (default 50)

If npm says Missing script, you need latest main:
  git pull origin main
`);
  process.exit(0);
}

const apply = process.argv.includes('--apply');
const sinceArg = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1] || '2026-08-25';
const minGod = Math.max(0, Number(process.argv.find((a) => a.startsWith('--min-god='))?.split('=')[1] || 70));
const limit = Math.min(100, Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 25)));
const maxMatches = Math.min(100, Math.max(10, Number(process.argv.find((a) => a.startsWith('--max-matches='))?.split('=')[1] || 50)));

console.error(
  `[drain-unmatched] mode=${apply ? 'apply' : 'dry-run'} since=${sinceArg} min-god=${minGod} limit=${limit}`,
);

const PUBLISHER_RE =
  /\b(techcrunch|ventureburn|finsmes|forbes|bloomberg|reuters|axios|medium|substack|youtube|linkedin|twitter|crunchbase|pitchbook|pehub|prnewswire|thefintechtimes|eu-startups|entrackr)\b/i;

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function looksLikeHeadlineJunk(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 48) return true;
  if (/\b(revealed|appears?|reportedly|raises?|raised|funding|series [a-f]|rebound|oil flows)\b/i.test(n)) return true;
  if ((n.match(/\s+/g) || []).length >= 4) return true;
  return false;
}

const url = resolveSupabaseRestUrl().url;
const key = resolveSupabaseServiceKey();
if (!url || !key || !process.env.DATABASE_URL) throw new Error('Missing Supabase/DATABASE_URL env');

const db = createClient(url, key, { auth: { persistSession: false } });
const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});
const svc = new EnhancedMatchingService(db);

async function main() {
  const { rows } = await pool.query(
    `
    SELECT s.id, s.name, s.website, s.created_at, s.entity_gate, s.total_god_score,
           extract(epoch from (now() - s.created_at)) / 60.0 AS age_min
    FROM startup_uploads s
    WHERE s.status = 'approved'
      AND s.source_type = 'url'
      AND coalesce(s.website, '') <> ''
      AND s.entity_gate IS DISTINCT FROM 'junk'
      AND s.created_at >= $1::timestamptz
      AND coalesce(s.total_god_score, 0) >= $2
      AND NOT EXISTS (
        SELECT 1 FROM startup_investor_matches m WHERE m.startup_id = s.id
      )
    ORDER BY s.created_at DESC, s.total_god_score DESC NULLS LAST
    LIMIT 200
    `,
    [sinceArg, minGod],
  );

  const candidates = rows.filter(
    (r) => !PUBLISHER_RE.test(r.website || '') && !looksLikeHeadlineJunk(r.name),
  ).slice(0, limit);

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    since: sinceArg,
    minGod,
    scanned: rows.length,
    candidates: candidates.length,
    matched: 0,
    failed: 0,
    results: [],
  };

  for (const row of candidates) {
    const sample = {
      name: row.name,
      website: row.website,
      god: row.total_god_score,
      age_min: Math.round(Number(row.age_min) || 0),
      entity_gate: row.entity_gate,
    };
    if (!apply) {
      summary.results.push({ ...sample, status: 'would_match' });
      continue;
    }

    if (row.entity_gate !== 'qualified') {
      await db.from('startup_uploads').update({ entity_gate: 'qualified' }).eq('id', row.id);
    }

    // Boost any pending queue row so workers prefer these over the 97k backlog.
    await pool.query(
      `
      UPDATE match_generation_queue
      SET priority = GREATEST(priority, 90000),
          updated_at = now(),
          last_error = null
      WHERE startup_id = $1 AND status = 'pending'
      `,
      [row.id],
    ).catch(() => null);

    const { rows: pending } = await pool.query(
      `SELECT id FROM match_generation_queue WHERE startup_id = $1 AND status = 'pending' LIMIT 1`,
      [row.id],
    );
    if (!pending.length) {
      await pool.query(
        `
        INSERT INTO match_generation_queue (startup_id, status, priority, attempts, updated_at)
        VALUES ($1, 'pending', 90000, 0, now())
        `,
        [row.id],
      ).catch(() => null);
    }

    const result = await svc.generateMatches(row.id, { maxMatches, minScore: 20 });
    if (result?.success) {
      summary.matched += 1;
      summary.results.push({
        ...sample,
        status: 'matched',
        matchCount: result.matchCount,
        topScore: result.topScore,
      });
      await pool.query(
        `UPDATE match_generation_queue
         SET status = 'completed', completed_at = now(), updated_at = now()
         WHERE startup_id = $1 AND status IN ('pending', 'processing')`,
        [row.id],
      ).catch(() => null);
    } else {
      summary.failed += 1;
      summary.results.push({
        ...sample,
        status: 'failed',
        error: result?.error || result?.skipped || 'unknown',
      });
    }
  }

  await pool.end();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
