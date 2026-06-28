#!/usr/bin/env node
/**
 * Create idx_sim_hot_created_score with CONCURRENTLY (requires DATABASE_URL / direct Postgres).
 * Falls back to exec_sql_modify without CONCURRENTLY if DATABASE_URL is missing.
 *
 * Usage: npm run db:hot-matches-index
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const INDEX_NAME = 'idx_sim_hot_created_score';
const INDEX_SQL = `
CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX_NAME}
  ON public.startup_investor_matches (created_at DESC, match_score DESC)
  WHERE match_score >= 60
`;

const INDEX_SQL_BLOCKING = `
CREATE INDEX IF NOT EXISTS ${INDEX_NAME}
  ON public.startup_investor_matches (created_at DESC, match_score DESC)
  WHERE match_score >= 60
`;

async function viaPostgres() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return false;

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    const exists = await client.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
      [INDEX_NAME],
    );
    if (exists.rowCount > 0) {
      console.log(`✅ Index ${INDEX_NAME} already exists`);
      return true;
    }

    console.log(`[index] Creating ${INDEX_NAME} CONCURRENTLY (may take several minutes)…`);
    await client.query(INDEX_SQL);
    console.log(`✅ Index ${INDEX_NAME} created`);
    return true;
  } finally {
    await client.end();
  }
}

async function viaRpc() {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  console.warn('[index] DATABASE_URL not set — using exec_sql_modify (blocking, may timeout on large tables)');
  const { data, error } = await supabase.rpc('exec_sql_modify', { sql_query: INDEX_SQL_BLOCKING });
  if (error) throw new Error(error.message);
  if (data?.success === false) throw new Error(data.error || 'exec_sql_modify failed');
  console.log(`✅ Index ${INDEX_NAME} created (blocking)`);
  return true;
}

try {
  const ok = (await viaPostgres()) || (await viaRpc());
  if (!ok) {
    console.error('Set DATABASE_URL in .env for CONCURRENTLY index creation.');
    process.exit(1);
  }
} catch (err) {
  console.error('[index] Failed:', err.message || err);
  process.exit(1);
}
