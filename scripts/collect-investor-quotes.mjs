#!/usr/bin/env node
/**
 * Collect investor quotes from stored thesis and portfolio text.
 * Usage: node scripts/collect-investor-quotes.mjs --apply --limit=400
 */
import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { KINDS, quotesFromInvestor } = require('../lib/investorQuotes.js');

const apply = process.argv.includes('--apply');
const limit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 400);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function ensureTable() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const sqlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20260929020000_investor_quotes.sql');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
    query_timeout: 20000,
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    client.connection?.stream?.destroy();
  }, 12000);
  try {
    await client.connect();
    if (timedOut) throw new Error('database connect timed out');
    await client.query(readFileSync(sqlPath, 'utf8'));
    await client.query(`notify pgrst, 'reload schema'`);
  } finally {
    clearTimeout(timer);
    client.end().catch(() => {});
  }
}

async function main() {
  if (apply) {
    const probe = await supabase.from('investor_quotes').select('id').limit(1);
    const missing = probe.error && /schema cache|does not exist|relation/i.test(probe.error.message);
    if (missing) {
      try {
        await ensureTable();
      } catch (err) {
        console.warn(`table ensure skipped: ${err.message || err}`);
      }
    }
  }
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, firm, investment_thesis, notable_investments')
    .not('investment_thesis', 'is', null)
    .limit(limit);
  if (error) throw error;

  const quotes = [];
  for (const row of data || []) quotes.push(...quotesFromInvestor(row));
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, quotes.filter((quote) => quote.kind === kind).length]));
  console.log(`investors ${data?.length || 0} · quotes ${quotes.length} · ${JSON.stringify(byKind)} · ${apply ? 'APPLY' : 'dry-run'}`);
  for (const quote of quotes.slice(0, 8)) {
    console.log(`  [${quote.kind}] ${quote.firm}: ${quote.quote.slice(0, 110)}`);
  }
  if (!apply || !quotes.length) return;

  const seen = new Set();
  const unique = quotes.filter((quote) => {
    const key = quote.quote.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await supabase.from('investor_quotes').update({ active: false }).not('id', 'is', null);

  const chunk = 100;
  let written = 0;
  for (let i = 0; i < unique.length; i += chunk) {
    const batch = unique.slice(i, i + chunk);
    const { error: upsertError } = await supabase
      .from('investor_quotes')
      .upsert(batch.map(({ investor_id, firm, speaker, kind, quote, source }) => ({
        investor_id, firm, speaker, kind, quote, source, active: true,
      })), { onConflict: 'investor_id,kind,quote', ignoreDuplicates: false });
    if (upsertError) throw upsertError;
    written += batch.length;
  }
  console.log(`written ${written}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
