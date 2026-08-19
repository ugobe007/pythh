#!/usr/bin/env node
/**
 * Mac-safe DATABASE_URL diagnostics (no sed, no zsh ! history issues).
 * Usage: npm run env:db-check
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');

console.log('\n── .env location (this is the ONLY file dq:runbook reads) ──');
console.log('  ', ENV_PATH);
console.log('  exists:', fs.existsSync(ENV_PATH));

if (!fs.existsSync(ENV_PATH)) {
  console.log('\nCreate it: cp .env.example .env');
  process.exit(1);
}

dotenv.config({ path: ENV_PATH, quiet: true });

const dupes = fs
  .readFileSync(ENV_PATH, 'utf8')
  .split('\n')
  .map((l, i) => ({ l, i: i + 1 }))
  .filter(({ l }) => /^DATABASE_URL=/.test(l.trim()));
if (dupes.length > 1) {
  console.log('\n⚠️  Multiple DATABASE_URL lines (only the last one wins):');
  for (const { l, i } of dupes) console.log(`  line ${i}: ${l.slice(0, 60)}…`);
}

const raw = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
if (!raw) {
  console.log('\n❌ DATABASE_URL is missing from .env');
  console.log('Fix: npm run env:db-set');
  console.log(
    'Supabase: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/database → Connect → Session pooler :5432',
  );
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(raw.replace(/^postgresql:/, 'postgres:'));
} catch {
  console.log('\n❌ DATABASE_URL is not a valid URI (broken line or special chars?)');
  console.log('Fix: npm run env:db-set');
  process.exit(1);
}

const user = decodeURIComponent(parsed.username || '');
const host = parsed.hostname || '';
const port = parsed.port || '5432';
const passLen = (parsed.password || '').length;

console.log('\n── DATABASE_URL shape ──');
console.log('  host:', host);
console.log('  port:', port);
console.log('  user:', user);
console.log('  password length:', passLen);

if (/pooler\.supabase\.com/i.test(host) && user === 'postgres') {
  console.log(
    '\n⚠️  Pooler host but username is "postgres" — use postgres.unkpogyhhjbvxxjvmxlt (copy URI from Supabase Connect).',
  );
}
if (passLen === 0) {
  console.log('\n❌ Password part is empty — URI is truncated (check for # or spaces in .env).');
  process.exit(1);
}

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  const v = String(process.env.DATABASE_SSL || '').toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return s;
  const isSupabase = /supabase\.com/i.test(s) || /\.supabase\.co/i.test(s);
  if (!(/supabase\.com/i.test(s) || /\.supabase\.co/i.test(s)) && v !== 'true' && v !== '1' && v !== 'yes') {
    return s;
  }
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

console.log('\n── Postgres connect test (same as dq:runbook) ──');
const pool = new pg.Pool({ connectionString: massageConnectionString(raw), max: 1 });
try {
  await pool.query('select 1 as ok');
  console.log('  ✅ Connected — npm run dq:runbook should work');
} catch (e) {
  console.log('  ❌', e.code || 'ERROR', e.message);
  if (e.code === '28P01') {
    console.log('\n28P01 = wrong database password in DATABASE_URL (not anon/service JWT).');
    console.log('Fix: npm run env:db-set');
    console.log(
      'Dashboard: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/database',
    );
  }
  process.exit(1);
} finally {
  await pool.end();
}

console.log('');
