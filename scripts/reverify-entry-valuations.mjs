#!/usr/bin/env node
/**
 * RE-SOURCE ENTRY VALUATIONS (mark-to-market integrity)
 * =====================================================
 * Entry valuations were stage-based estimates ($50M / $80M) applied regardless of
 * the company's real size at pick time. That produced fake 50–100× multiples when a
 * recently-picked, already-mature company (e.g. Verkada, LaunchDarkly, Odoo) was
 * measured against its real multi-billion current valuation.
 *
 * Honest fix: entry valuation = the company's REAL post-money valuation as of its
 * entry_date (the most recent round that had CLOSED on or before entry). MOIC then
 * reflects only appreciation SINCE Pythia picked it.
 *
 * Rules:
 *   • Only consider rounds CLOSED on/before entry_date. Ignore later or rumored rounds.
 *   • If the company was already large at entry, that large valuation IS the entry basis.
 *   • entry must be plausible: 0 < entry <= current valuation (a winner can't enter above
 *     its current mark; if reported entry >= current, treat as flat → entry = current → 1×).
 *   • Can't verify a real entry valuation → hold at COST: entry = current (1×). No fudging.
 *
 * Usage:
 *   node scripts/reverify-entry-valuations.mjs            # dry-run (default)
 *   node scripts/reverify-entry-valuations.mjs --apply
 *   node scripts/reverify-entry-valuations.mjs --name Baseten
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../server/lib/portfolioFundingVerify.js';
import { computePortfolioValue } from '../server/lib/portfolioAnalytics.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const nameArg = process.argv.indexOf('--name');
const ONLY_NAME = nameArg > -1 ? process.argv[nameArg + 1] : null;
const MAX_PLAUSIBLE = 15_000_000_000;

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
  const q = encodeURIComponent(`"${company}" valuation OR raises OR Series OR funding`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 8);
}

async function valuationAt(company, entryMonth, items) {
  if (!items.length) return null;
  const corpus = items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n');
  const prompt = `You are a venture analyst establishing the cost basis for "${company}" as of ${entryMonth}.
Determine the company's post-money valuation AS OF ${entryMonth}, using only the most recent funding round that had ALREADY CLOSED on or before ${entryMonth}.

STRICT RULES:
- Use only CLOSED rounds dated on or before ${entryMonth}. Ignore rounds after that date and anything rumored/"in talks".
- If the company was already a large/established company by ${entryMonth}, report that valuation.
- Headlines MUST be about "${company}" (the company), not a market-size figure or a different firm.
- Do NOT estimate a valuation that is not supported by the headlines.

Headlines:
${corpus}

Return ONLY JSON: {"matched":bool,"valuation_at_entry_usd":number|null,"as_of":string|null,"headline":string|null}`;
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

const m = (n) => (n == null ? '—' : '$' + (Number(n) / 1e6).toFixed(0) + 'M');

async function main() {
  console.log(`\n🎯 Re-sourcing ENTRY valuations (mark-to-market) ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);
  const client = sb();

  const { data: picks } = await client
    .from('virtual_portfolio')
    .select('id, startup_id, entry_valuation_usd, entry_date, created_at');
  const { data: events } = await client
    .from('portfolio_events')
    .select('startup_id, post_money_usd, event_date, verified')
    .eq('event_type', 'funding_round').eq('verified', true)
    .order('event_date', { ascending: false });

  const currentByStartup = new Map();
  for (const e of events || []) {
    const v = Number(e.post_money_usd);
    if (v > 0 && v <= MAX_PLAUSIBLE && !currentByStartup.has(e.startup_id)) currentByStartup.set(e.startup_id, v);
  }

  let marked = (picks || []).filter((p) => currentByStartup.has(p.startup_id));
  const ids = marked.map((p) => p.startup_id);
  const nameById = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await client.from('startup_uploads').select('id, name').in('id', ids.slice(i, i + 200));
    (data || []).forEach((r) => nameById.set(r.id, r.name));
  }
  if (ONLY_NAME) marked = marked.filter((p) => (nameById.get(p.startup_id) || '').toLowerCase().includes(ONLY_NAME.toLowerCase()));

  console.log('company'.padEnd(18), 'old entry'.padStart(10), 'new entry'.padStart(10), 'current'.padStart(9), 'moic'.padStart(7), '  basis');
  console.log('-'.repeat(86));

  let sourced = 0, cost = 0;
  for (const p of marked) {
    const name = nameById.get(p.startup_id);
    const current = currentByStartup.get(p.startup_id);
    const entryMonth = (p.entry_date || p.created_at || '').slice(0, 7);
    const items = await headlines(name);
    const ex = await valuationAt(name, entryMonth, items);

    let newEntry, basis;
    const v = ex && ex.matched ? Number(ex.valuation_at_entry_usd) : NaN;
    if (v > 0 && v <= MAX_PLAUSIBLE) {
      newEntry = Math.min(v, current); // can't enter above current mark
      basis = newEntry >= current ? 'flat (entry≈current)' : `press as-of ${ex.as_of || entryMonth}`;
      sourced++;
    } else {
      newEntry = current; // hold at cost — unverifiable entry
      basis = 'cost (entry unverifiable)';
      cost++;
    }
    const moic = (current / newEntry);
    console.log(name.slice(0, 17).padEnd(18), m(p.entry_valuation_usd).padStart(10), m(newEntry).padStart(10), m(current).padStart(9), (moic.toFixed(2) + 'x').padStart(7), ' ', basis);

    if (APPLY) {
      await client.from('virtual_portfolio').update({ entry_valuation_usd: Math.round(newEntry) }).eq('id', p.id);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log('-'.repeat(86));
  console.log(`\n${sourced} entry valuations press-sourced, ${cost} held at cost.`);

  if (APPLY) {
    const val = await computePortfolioValue(client);
    console.log(`\n📊 Portfolio after entry re-sourcing: Avg MOIC ${val.avg_moic_capped}× | marked ${val.marked_positions}/${val.positions}`);
  } else {
    console.log('\n(dry-run — re-run with --apply to persist.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
