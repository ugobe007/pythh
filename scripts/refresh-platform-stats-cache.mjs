#!/usr/bin/env node
/**
 * Full-table COUNT(*) refresh → platform_stats_cache (homepage + /api/platform-stats).
 * Run after match-regenerator --full or weekly dashboard.
 *
 * Usage:
 *   node scripts/refresh-platform-stats-cache.mjs
 *   node scripts/refresh-platform-stats-cache.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply') || !process.argv.includes('--dry-run');
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const daysAgoIso = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

function errMsg(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || String(e);
  return e.message || e.details || e.hint || JSON.stringify(e);
}

async function count(table, filter) {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c, error } = await q;
  if (error) throw new Error(`${table} count: ${errMsg(error)}`);
  return c ?? 0;
}

async function countSignalScores() {
  const { count: c, error } = await sb
    .from('startup_signal_scores')
    .select('startup_id', { count: 'exact', head: true });
  if (error) throw new Error(`startup_signal_scores count: ${errMsg(error)}`);
  return c ?? 0;
}

/** Full COUNT(*) on 3.7M+ match rows hits statement timeout — use reltuples (~1% error). */
async function countMatchesTotal() {
  const { count: exact, error } = await sb
    .from('startup_investor_matches')
    .select('id', { count: 'exact', head: true });
  if (!error && exact != null) return exact;

  const { data, error: approxErr } = await sb.rpc('exec_sql_rows', {
    sql_query: `SELECT reltuples::bigint AS n FROM pg_class WHERE relname = 'startup_investor_matches'`,
  });
  if (approxErr || !data?.[0]?.n) {
    throw new Error(`match count: ${errMsg(approxErr) || 'unavailable'}`);
  }
  console.log('   (matches total via pg_class estimate — exact COUNT timed out)');
  return Number(data[0].n);
}

export async function refreshPlatformStatsCache({ source = 'refresh-platform-stats-cache.mjs' } = {}) {
  console.log('📊 Refreshing platform_stats_cache (full-table counts)…');
  const t0 = Date.now();

  const [startups, startups_total, investors, matches, matches_new_7d, matches_new_30d, signals] =
    await Promise.all([
      count('startup_uploads', (q) => q.eq('status', 'approved')),
      count('startup_uploads'),
      count('investors'),
      countMatchesTotal(),
      count('startup_investor_matches', (q) => q.gte('created_at', daysAgoIso(7))),
      count('startup_investor_matches', (q) => q.gte('created_at', daysAgoIso(30))),
      countSignalScores(),
    ]);

  const row = {
    id: 1,
    startups,
    startups_total,
    investors,
    matches,
    matches_new_7d,
    matches_new_30d,
    signals,
    updated_at: new Date().toISOString(),
    refresh_source: source,
  };

  console.log(`   startups ${startups.toLocaleString()} · investors ${investors.toLocaleString()}`);
  console.log(`   matches ${matches.toLocaleString()} · 7d ${matches_new_7d.toLocaleString()} · signals ${signals.toLocaleString()}`);
  console.log(`   elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (!APPLY) {
    console.log('   (dry-run — pass --apply to write)');
    return row;
  }

  const { error } = await sb.from('platform_stats_cache').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`upsert failed: ${error.message}`);
  console.log('✅ platform_stats_cache updated');
  return row;
}

refreshPlatformStatsCache().catch((e) => {
  console.error('Fatal:', errMsg(e));
  process.exit(1);
});
