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
const { quotesFromHtml, innerPageUrls, spokenQuotesFromInvestor, sameFirmHost } = require('../lib/vcQuoteCapture.js');
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
  if (!res.ok) return { html: '', finalUrl: url };
  const html = await res.text();
  return { html: html.slice(0, 500_000), finalUrl: res.url };
}

function hostOf(investor) {
  const raw = investor?.url || investor?.blog_url || '';
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function quoteForInvestor(investor, quote) {
  const firm = String(investor.firm || investor.name || quote.firm || '').replace(/\s+/g, ' ').trim();
  const name = String(investor.name || '').trim();
  const speaker = name && name.toLowerCase() !== firm.toLowerCase() && name.split(/\s+/).length <= 4 ? name : firm;
  return { ...quote, investor_id: investor.id, firm, speaker };
}

async function investorGroups() {
  const { data, error } = await supabase
    .from('startup_investor_matches')
    .select('investor_id, investors(id, name, firm, url, blog_url, investment_thesis)')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  const groups = new Map();
  for (const row of data || []) {
    const investor = Array.isArray(row.investors) ? row.investors[0] : row.investors;
    if (!investor?.id) continue;
    if (!investor.url && !investor.blog_url && !investor.investment_thesis) continue;
    const key = hostOf(investor) || `id:${investor.id}`;
    if (!groups.has(key)) {
      if (groups.size >= 400) continue;
      groups.set(key, []);
    }
    const list = groups.get(key);
    if (!list || list.length >= 4 || list.some((item) => item.id === investor.id)) continue;
    list.push(investor);
  }
  return [...groups.values()].filter((group) => group.length);
}

async function quotedInvestorIds(groups) {
  const ids = groups.flat().map((investor) => investor.id);
  const quoted = new Set();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('investor_quotes')
      .select('investor_id')
      .eq('active', true)
      .in('investor_id', ids.slice(i, i + 150));
    if (error) throw error;
    for (const row of data || []) quoted.add(row.investor_id);
  }
  return quoted;
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
    const retired = await retireUndisplayableQuotes();
    console.log(`retired ${retired}`);
  }

  const allGroups = await investorGroups();
  const alreadyQuoted = await quotedInvestorIds(allGroups);
  const groups = allGroups
    .filter((group) => group.some((investor) => !alreadyQuoted.has(investor.id)))
    .slice(0, limit);
  const quotes = [];
  let fetched = 0;
  for (const group of groups) {
    for (const investor of group) quotes.push(...spokenQuotesFromInvestor(investor));
    if (group.every((investor) => alreadyQuoted.has(investor.id))) continue;
    const reader = group.find((investor) => investor.url || investor.blog_url);
    if (!reader) continue;
    const start = reader.url || reader.blog_url;
    const home = start.startsWith('http') ? start : `https://${start}`;
    if (!sameFirmHost(home, reader)) continue;
    fetched += 1;
    try {
      const { html, finalUrl } = await fetchPage(home);
      let pageQuotes = quotesFromHtml(html, finalUrl, reader);
      const needsNamed = !pageQuotes.some((quote) => quote.kind === 'invested_in' || quote.kind === 'founder_advice');
      if (needsNamed) {
        for (const page of pagesToRead(html, finalUrl, reader).slice(0, 2)) {
          await sleep(delay);
          const { html: inner, finalUrl: innerFinalUrl } = await fetchPage(page);
          pageQuotes = pageQuotes.concat(quotesFromHtml(inner, innerFinalUrl, reader));
        }
      }
      for (const investor of group) {
        if (alreadyQuoted.has(investor.id)) continue;
        for (const quote of pageQuotes) quotes.push(quoteForInvestor(investor, quote));
      }
    } catch (err) {
      console.warn(`fetch ${home}: ${err.message || err}`);
    }
    await sleep(delay);
  }

  const seen = new Map();
  const unique = [];
  for (const quote of quotes) {
    const key = `${quote.investor_id}:${quote.kind}:${quote.quote.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || (!existing.source_url && quote.source_url)) {
      if (existing) {
        const idx = unique.indexOf(existing);
        if (idx !== -1) unique.splice(idx, 1);
      }
      seen.set(key, quote);
      unique.push(quote);
    }
  }
  const byKind = unique.reduce((acc, quote) => {
    acc[quote.kind] = (acc[quote.kind] || 0) + 1;
    return acc;
  }, {});
  console.log(`firms ${groups.length} · fetched ${fetched} · quotes ${unique.length} · ${JSON.stringify(byKind)} · ${apply ? 'APPLY' : 'dry-run'}`);
  for (const quote of unique.slice(0, 40)) {
    console.log(`  [${quote.kind}] ${quote.firm}: ${quote.quote.slice(0, 180)}`);
  }
  if (!apply || !unique.length) return;
  const { written, heldAdvice } = await upsertQuotes(unique);
  console.log(`written ${written}${heldAdvice ? ` · held founder_advice ${heldAdvice} until the kind constraint exists` : ''}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
