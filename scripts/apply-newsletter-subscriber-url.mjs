#!/usr/bin/env node
/**
 * Add startup_url / startup_id on newsletter_subscribers.
 *   node scripts/apply-newsletter-subscriber-url.mjs --apply
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const sql = readFileSync(new URL('../supabase/migrations/20260909000000_newsletter_subscriber_startup_url.sql', import.meta.url), 'utf8');

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', sql }, null, 2));
  process.exit(0);
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service environment');

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};
const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ sql }),
});
if (!res.ok) {
  const body = await res.text();
  console.log(JSON.stringify({ mode: 'apply', ok: false, status: res.status, body, hint: 'Run the migration SQL in Supabase if exec_sql is unavailable.' }, null, 2));
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db.from('newsletter_subscribers').select('email, startup_url').limit(1);
if (error) throw new Error(error.message);
console.log(JSON.stringify({ mode: 'apply', ok: true }, null, 2));
