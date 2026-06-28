#!/usr/bin/env node
/**
 * Apply get_platform_velocity optimization via exec_sql_modify RPC.
 *
 * Usage: npm run db:platform-velocity-optimize
 */

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
  path.join(__dirname, '../supabase/migrations/20260628130000_optimize_platform_velocity.sql'),
  'utf8',
);

console.log('[platform-velocity] Applying optimization…');
const { data, error } = await supabase.rpc('exec_sql_modify', { sql_query: sql });
if (error) {
  console.error('RPC error:', error.message);
  process.exit(1);
}
if (data && data.success === false) {
  console.error('SQL error:', data.error, data.code);
  process.exit(1);
}

const t0 = Date.now();
const { data: v, error: vErr } = await supabase.rpc('get_platform_velocity');
const ms = Date.now() - t0;
if (vErr) {
  console.error('Verify FAIL:', vErr.message);
  process.exit(1);
}
const row = v?.[0] || {};
console.log(`✅ get_platform_velocity in ${ms}ms — week=${row.total_matches_week} today=${row.total_matches_today}`);
