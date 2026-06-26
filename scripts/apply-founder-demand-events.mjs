#!/usr/bin/env node
/**
 * Apply founder_demand_events migration via exec_sql_modify.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(root, 'supabase/migrations/20260626000000_founder_demand_events.sql');

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^--[^\n]*\n/gm, '').trim())
    .filter(Boolean);
}

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const stmts = splitStatements(sql);
  console.log(`Applying founder_demand_events (${stmts.length} statements)…`);
  for (let i = 0; i < stmts.length; i++) {
    const stmt = `${stmts[i]};`;
    const { error } = await sb.rpc('exec_sql_modify', { sql_query: stmt });
    if (error) {
      console.error(`Statement ${i + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  [${i + 1}/${stmts.length}] ok`);
  }
  console.log('✅ founder_demand_events ready');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
