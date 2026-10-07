#!/usr/bin/env node
/**
 * Capture spoken VC lines: what they fund, investments they name, advice to founders.
 * Firm pages and stored thesis only. Dry-run unless --apply.
 *
 *   node scripts/capture-vc-quotes.mjs --limit=20
 *   node scripts/capture-vc-quotes.mjs --apply --limit=20 --delay=700
 */
import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { quotesFromHtml, innerPageUrls, spokenQuotesFromInvestor } = require('../lib/vcQuoteCapture.js');
const { isDisplayableQuote } = require('../lib/investorQuotes.js');

const FALLBACK_PATHS = ['/about', '/manifesto', '/how-we-work', '/how-we-invest', '/thesis', '/what-we-look-for'];

const apply = process.argv.includes('--apply');
const limit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 20);
const delay = Number(process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || 700);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function ensureAdviceColumn() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL missing — quote rows will store the page on source until source_url exists');
    return;
  }
  const sqlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20261007040000_investor_quote_advice.sql');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
    query_timeout: 20000,
  });
  try {
    await client.connect();
    await client.query(readFileSync(sqlPath, 'utf8'));
    await client.query(`notify pgrst, 'reload schema'`);
  } finally {
    client.end().catch(() => {});
  }
}

async function fetchPage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'pythh-quote-capture/1.0', accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return '';
  const html = await res.text();
  return html.slice(0, 500_000);
}

async function recentInvestors() {
  const { data, error } = await supabase
    .from('startup_investor_matches')
    .select('investor_id, investors(id, name, firm, url, blog_url, investment_thesis)')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit * 8, 400));
  if (error) throw error;
  const seen = new Set();
  const rows = [];
  for (const row of data || []) {
    const investor = Array.isArray(row.investors) ? row.investors[0] : row.investors;
    if (!investor?.id || seen.has(investor.id)) continue;
    if (!investor.url && !investor.blog_url && !investor.investment_thesis) continue;
    seen.add(investor.id);
    rows.push(investor);
    if (rows.length >= limit) break;
  }
  return rows;
}

function pagesToRead(html, home, investor) {
  const linked = innerPageUrls(html, home, investor);
  if (linked.length) return linked;
  let origin = '';
  try { origin = new URL(home).origin; } catch { return []; }
  return FALLBACK_PATHS.slice(0, 3).map((path) => origin + path);
}

async function upsertQuotes(rows) {
  let sourceUrlColumn = true;
  let adviceKind = true;
  let written = 0;
  let heldAdvice = 0;
  for (let i = 0; i < rows.length; i += 80) {
    let batch = rows.slice(i, i + 80).map(({ investor_id, firm, speaker, kind, quote, source, source_url }) => ({
      investor_id, firm, speaker, kind, quote, source, source_url, active: true,
    }));
    if (!adviceKind) {
      heldAdvice += batch.filter((row) => row.kind === 'founder_advice').length;
      batch = batch.filter((row) => row.kind !== 'founder_advice');
    }
    if (!batch.length) continue;
    const payload = () => (sourceUrlColumn
      ? batch
      : batch.map(({ source_url, ...row }) => ({ ...row, source: source_url || row.source })));
    let { error } = await supabase.from('investor_quotes').upsert(payload(), {
      onConflict: 'investor_id,kind,quote',
      ignoreDuplicates: false,
    });
    if (error && sourceUrlColumn && /source_url/i.test(error.message || '')) {
      sourceUrlColumn = false;
      ({ error } = await supabase.from('investor_quotes').upsert(payload(), {
        onConflict: 'investor_id,kind,quote',
        ignoreDuplicates: false,
      }));
    }
    if (error && adviceKind && /kind_check|founder_advice|check constraint/i.test(error.message || '')) {
      adviceKind = false;
      const rest = batch.filter((row) => row.kind !== 'founder_advice');
      heldAdvice += batch.length - rest.length;
      if (rest.length) {
        const fallback = sourceUrlColumn
          ? rest
          : rest.map(({ source_url, ...row }) => ({ ...row, source: source_url || row.source }));
        ({ error } = await supabase.from('investor_quotes').upsert(fallback, {
          onConflict: 'investor_id,kind,quote',
          ignoreDuplicates: false,
        }));
        batch = rest;
      } else {
        error = null;
        batch = [];
      }
    }
    if (error) throw error;
    written += batch.length;
  }
  return { written, heldAdvice };
}

async function retireUndisplayableQuotes() {
  const { data, error } = await supabase
    .from('investor_quotes')
    .select('id, quote, source')
    .eq('active', true)
    .limit(1000);
  if (error) throw error;
  const ids = (data || [])
    .filter((row) => row.source === 'notable_investments' || !isDisplayableQuote(row.quote))
    .map((row) => row.id);
  if (!ids.length) return 0;
  const { error: updateError } = await supabase.from('investor_quotes').update({ active: false }).in('id', ids);
  if (updateError) throw updateError;
  return ids.length;
}

async function main() {
  if (apply) {
    try {
      await ensureAdviceColumn();
    } catch (err) {
      console.warn(`advice column ensure skipped: ${err.message || err}`);
    }
  }

  const investors = await recentInvestors();
  const quotes = [];
  for (const investor of investors) {
    quotes.push(...spokenQuotesFromInvestor(investor));
    const start = investor.url || investor.blog_url;
    if (!start) continue;
    const home = start.startsWith('http') ? start : `https://${start}`;
    try {
      const html = await fetchPage(home);
      quotes.push(...quotesFromHtml(html, home, investor));
      for (const page of pagesToRead(html, home, investor)) {
        await sleep(delay);
        const inner = await fetchPage(page);
        quotes.push(...quotesFromHtml(inner, page, investor));
      }
    } catch (err) {
      console.warn(`fetch ${home}: ${err.message || err}`);
    }
    await sleep(delay);
  }

  const seen = new Set();
  const unique = quotes.filter((quote) => {
    const key = `${quote.firm.toLowerCase()}:${quote.kind}:${quote.quote.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const byKind = unique.reduce((acc, quote) => {
    acc[quote.kind] = (acc[quote.kind] || 0) + 1;
    return acc;
  }, {});
  console.log(`investors ${investors.length} · quotes ${unique.length} · ${JSON.stringify(byKind)} · ${apply ? 'APPLY' : 'dry-run'}`);
  for (const quote of unique.slice(0, 40)) {
    console.log(`  [${quote.kind}] ${quote.firm}: ${quote.quote.slice(0, 180)}`);
  }
  if (!apply) return;

  const retired = await retireUndisplayableQuotes();
  console.log(`retired ${retired}`);
  if (!unique.length) return;
  const { written, heldAdvice } = await upsertQuotes(unique);
  console.log(`written ${written}${heldAdvice ? ` · held founder_advice ${heldAdvice} until the kind constraint exists` : ''}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
