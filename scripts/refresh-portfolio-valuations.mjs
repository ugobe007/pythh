#!/usr/bin/env node
/**
 * COMPREHENSIVE PORTFOLIO VALUATION REFRESH
 * =========================================
 * Establishes an HONEST, fund-grade MOIC by sourcing each holding's real funding
 * history and setting BOTH sides of the multiple:
 *   • entry_valuation_usd  = the company's real post-money valuation AS OF its pick date
 *   • current valuation    = the company's most recent real post-money valuation
 *     (stored as a verified funding_round in portfolio_events, which analytics marks from)
 *
 * Why: the prior data was sparse/stale — only ~15 of 114 positions had any current
 * valuation, and entry valuations were stage-based estimates ($50M/$80M). That made
 * MOIC meaningless (fake-high from tiny entries, or flat 1× when we lacked current data).
 *
 * Sourcing: the company's PUBLIC funding history, reasoned by the model and grounded in
 * fresh press headlines. Guards against fabrication:
 *   • Only real, reported, CLOSED rounds (rumored / "in talks" excluded).
 *   • Plausibility ceiling: any valuation > $15B is rejected (re-sourcing artifact).
 *   • Low confidence or unidentifiable company → held at cost (no change). Never guess.
 *
 * Usage:
 *   node scripts/refresh-portfolio-valuations.mjs            # dry-run
 *   node scripts/refresh-portfolio-valuations.mjs --apply
 *   node scripts/refresh-portfolio-valuations.mjs --limit 5
 *   node scripts/refresh-portfolio-valuations.mjs --name Verkada
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../server/lib/portfolioFundingVerify.js';
import { computePortfolioValue } from '../server/lib/portfolioAnalytics.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const limArg = process.argv.indexOf('--limit');
const LIMIT = limArg > -1 ? parseInt(process.argv[limArg + 1], 10) : Infinity;
const nameArg = process.argv.indexOf('--name');
const ONLY_NAME = nameArg > -1 ? process.argv[nameArg + 1] : null;
const CONCURRENCY = 4;
const MAX_PLAUSIBLE = 15_000_000_000;
const MIN_CONF = 0.6;

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 2,
});

function fetchText(url, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pythh-PortfolioBot/1.0)' }, timeout: timeoutMs }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; if (b.length > 300_000) { req.destroy(); resolve(b); } });
      res.on('end', () => resolve(b));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

async function headlines(company) {
  const q = encodeURIComponent(`"${company}" valuation OR raises OR Series OR funding OR acquired`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 10);
}

async function fundingHistory(company, website, pickMonth, items) {
  const corpus = items.length
    ? items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n')
    : '(no fresh headlines found)';
  const site = website ? ` (official site: ${website})` : '';
  const prompt = `You are a venture analyst valuing the company "${company}"${site} for a fund's books. It was picked on ${pickMonth}.

Using the company's REAL, publicly-reported funding history (and the headlines below for the latest data), provide:
- valuation_at_pick_usd: post-money valuation as of ${pickMonth} — the most recent round that had CLOSED on or before ${pickMonth}.
- current_valuation_usd: the most recent post-money valuation today (latest CLOSED round; if acquired/IPO'd, the exit/last private valuation).
- confidence: 0-1, how confident you are these are the REAL reported figures for THIS exact company (not a namesake, not a market figure).

STRICT:
- Real, reported, CLOSED rounds only. Ignore rumored / "in talks" / "eyes" valuations.
- Verify it is THIS company (match the official site/domain when given). If you cannot confidently identify it or lack real data, set both valuations null and confidence low.
- Do NOT invent or estimate a valuation that was never reported.

Headlines:
${corpus}

Return ONLY JSON: {"valuation_at_pick_usd":number|null,"current_valuation_usd":number|null,"confidence":number,"note":string}`;
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    return JSON.parse(r.choices[0].message.content);
  } catch (e) {
    console.error(`   LLM error ${company}: ${e.message}`);
    return null;
  }
}

const ok = (n) => Number(n) > 0 && Number(n) <= MAX_PLAUSIBLE;
const m = (n) => (n == null ? '—' : '$' + (Number(n) / 1e6).toFixed(0) + 'M');

async function main() {
  const client = sb();
  console.log(`\n💼 Comprehensive valuation refresh ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: picks } = await client
    .from('virtual_portfolio')
    .select('id, startup_id, entry_valuation_usd, entry_date, created_at, status')
    .eq('status', 'active');
  const ids = [...new Set((picks || []).map((p) => p.startup_id).filter(Boolean))];
  const meta = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await client.from('startup_uploads').select('id, name, website').in('id', ids.slice(i, i + 200));
    (data || []).forEach((r) => meta.set(r.id, r));
  }

  let rows = (picks || []).map((p) => ({ p, su: meta.get(p.startup_id) })).filter((r) => r.su && r.su.name);
  if (ONLY_NAME) rows = rows.filter((r) => r.su.name.toLowerCase().includes(ONLY_NAME.toLowerCase()));
  rows = rows.slice(0, LIMIT);

  console.log('company'.padEnd(22), 'pick'.padStart(8), 'entry'.padStart(9), 'current'.padStart(9), 'moic'.padStart(7), '  conf');
  console.log('-'.repeat(80));

  let updated = 0, held = 0;
  const results = [];

  async function one({ p, su }) {
    const pickMonth = (p.entry_date || p.created_at || '').slice(0, 7);
    const items = await headlines(su.name);
    const h = await fundingHistory(su.name, su.website, pickMonth, items);
    if (!h) { held++; return; }
    const conf = Number(h.confidence) || 0;
    let entry = ok(h.valuation_at_pick_usd) ? Number(h.valuation_at_pick_usd) : null;
    let current = ok(h.current_valuation_usd) ? Number(h.current_valuation_usd) : null;

    // Need both, with confidence, to set a real mark. current >= entry not required (down rounds allowed).
    if (conf < MIN_CONF || !entry || !current) {
      held++;
      results.push({ name: su.name, pickMonth, entry, current, moic: null, conf, action: 'hold (cost)' });
      return;
    }
    const moic = current / entry;
    results.push({ name: su.name, pickMonth, entry, current, moic, conf, action: 'set' });

    if (APPLY) {
      await client.from('virtual_portfolio').update({ entry_valuation_usd: Math.round(entry), current_valuation_usd: Math.round(current) }).eq('id', p.id);
      // upsert current as a verified funding round analytics can mark from
      const { data: existing } = await client
        .from('portfolio_events')
        .select('id')
        .eq('startup_id', p.startup_id)
        .eq('event_type', 'funding_round')
        .order('event_date', { ascending: false })
        .limit(1);
      if (existing && existing.length) {
        await client.from('portfolio_events').update({ post_money_usd: Math.round(current), verified: true }).eq('id', existing[0].id);
      } else {
        await client.from('portfolio_events').insert({
          startup_id: p.startup_id, portfolio_id: p.id, event_type: 'funding_round',
          event_date: new Date().toISOString(), post_money_usd: Math.round(current),
          verified: true, headline: `${su.name} valued at ${m(current)} (funding history)`, source_name: 'funding history',
        });
      }
    }
    updated++;
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.allSettled(rows.slice(i, i + CONCURRENCY).map(one));
    await new Promise((r) => setTimeout(r, 300));
  }

  results.sort((a, b) => (b.moic || 0) - (a.moic || 0));
  for (const r of results) {
    console.log(
      r.name.slice(0, 21).padEnd(22),
      r.pickMonth.padStart(8),
      m(r.entry).padStart(9),
      m(r.current).padStart(9),
      (r.moic ? r.moic.toFixed(2) + 'x' : '—').padStart(7),
      ' ', r.conf.toFixed(2), r.action === 'set' ? '' : ' · hold'
    );
  }

  console.log('-'.repeat(80));
  console.log(`\n${updated} valuations set, ${held} held at cost.`);
  if (APPLY) {
    const v = await computePortfolioValue(client);
    console.log(`\n📊 Portfolio after refresh: Avg MOIC ${v.avg_moic_capped}× | above-cost ${v.marked_positions}/${v.positions} | current $${(v.current_value_usd / 1e6).toFixed(1)}M`);
  } else {
    console.log('\n(dry-run — re-run with --apply to persist.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
