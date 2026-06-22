#!/usr/bin/env node
/**
 * Apply product_agent migration via exec_sql_modify, then sync opportunity registry.
 */

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { syncRegistryToDb } = require('../server/lib/productOpportunities.js');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../supabase/migrations/20260622120000_product_agent.sql',
);

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^--[^\n]*\n/gm, '').trim())
    .filter(Boolean);
}

async function main() {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const stmts = splitStatements(sql);
  console.log(`Applying product_agent migration (${stmts.length} statements)…`);
  for (let i = 0; i < stmts.length; i++) {
    const stmt = `${stmts[i]};`;
    process.stdout.write(`  [${i + 1}/${stmts.length}] … `);
    const { error } = await sb.rpc('exec_sql_modify', { sql_query: stmt });
    if (error) {
      console.log('FAIL', error.message);
      throw error;
    }
    console.log('ok');
  }
  const { synced } = await syncRegistryToDb(sb);
  console.log(`✅ Synced ${synced} opportunities from opportunity-registry.json`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
