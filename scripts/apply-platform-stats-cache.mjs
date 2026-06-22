#!/usr/bin/env node
/**
 * Apply platform_stats_cache migration via exec_sql_modify (when supabase db push fails).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS public.platform_stats_cache (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  startups bigint NOT NULL DEFAULT 0,
  startups_total bigint NOT NULL DEFAULT 0,
  investors bigint NOT NULL DEFAULT 0,
  matches bigint NOT NULL DEFAULT 0,
  matches_new_7d bigint NOT NULL DEFAULT 0,
  matches_new_30d bigint NOT NULL DEFAULT 0,
  signals bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  refresh_source text
)`,
  `ALTER TABLE public.platform_stats_cache ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS platform_stats_cache_public_read ON public.platform_stats_cache`,
  `CREATE POLICY platform_stats_cache_public_read ON public.platform_stats_cache
  FOR SELECT TO anon, authenticated USING (true)`,
  `GRANT SELECT ON public.platform_stats_cache TO anon, authenticated`,
  `GRANT ALL ON public.platform_stats_cache TO service_role`,
  `CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT json_build_object(
        'startups', c.startups,
        'startups_total', c.startups_total,
        'investors', c.investors,
        'matches', c.matches,
        'matches_new_7d', c.matches_new_7d,
        'matches_new_30d', c.matches_new_30d,
        'signals', c.signals,
        'computed_at', c.updated_at,
        'source', COALESCE(c.refresh_source, 'cache')
      )
      FROM public.platform_stats_cache c
      WHERE c.id = 1 AND c.matches > 0
    ),
    json_build_object(
      'startups', 0,
      'startups_total', 0,
      'investors', 0,
      'matches', 0,
      'matches_new_7d', 0,
      'matches_new_30d', 0,
      'signals', 0,
      'computed_at', NOW(),
      'source', 'empty'
    )
  );
$$`,
  `GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role`,
];

async function main() {
  console.log(`Applying platform_stats_cache migration (${STATEMENTS.length} statements)…`);
  for (let i = 0; i < STATEMENTS.length; i++) {
    const preview = STATEMENTS[i].slice(0, 60).replace(/\s+/g, ' ');
    process.stdout.write(`  [${i + 1}/${STATEMENTS.length}] ${preview}… `);
    const { data, error } = await sb.rpc('exec_sql_modify', { sql_query: STATEMENTS[i] });
    if (error) {
      console.log('FAIL');
      throw new Error(error.message);
    }
    console.log(data?.success ? 'ok' : 'done');
  }
  console.log('\n✅ Migration applied. Run: node scripts/refresh-platform-stats-cache.mjs --apply');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
