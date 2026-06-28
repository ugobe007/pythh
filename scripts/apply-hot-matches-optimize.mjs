#!/usr/bin/env node
/** Apply optimize_hot_matches_sql migration via exec_sql_modify RPC. */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260628120000_optimize_hot_matches_sql.sql'),
  'utf8',
);

console.log('[hot-matches] Applying SQL optimization migration…');
const { data, error } = await supabase.rpc('exec_sql_modify', { sql_query: sql });
if (error) {
  console.error('RPC error:', error.message);
  process.exit(1);
}
if (data && data.success === false) {
  console.error('SQL error:', data.error, data.code);
  process.exit(1);
}
console.log('✅ Migration applied');

const { data: hm, error: hmErr } = await supabase.rpc('get_hot_matches', { limit_count: 2, hours_ago: 168 });
console.log(hmErr ? `get_hot_matches verify FAIL: ${hmErr.message}` : `✅ get_hot_matches → ${hm?.length ?? 0} rows`);

const { data: sh, error: shErr } = await supabase.rpc('get_sector_heat_map', { days_ago: 7 });
console.log(shErr ? `get_sector_heat_map verify FAIL: ${shErr.message}` : `✅ get_sector_heat_map → ${sh?.length ?? 0} sectors`);
