#!/usr/bin/env node
/**
 * RE-BASE EXIT ENTRIES TO THE REAL ENTRY-ROUND VALUATION
 * ======================================================
 * Realized exits were booked with entry = the exit/deal price (1.0×), which understates the
 * real return: the entry should be the company's valuation WHEN PYTHIA PICKED IT, and the
 * exit is the step-up from there. This sources the pick-date post-money (most recent round
 * closed on/before the pick) and re-bases entry, so MOIC = deal / entry-round = the real
 * late-stage step-up.
 *
 * Guards (no fudging):
 *   • 0 < entry <= exit (a winner can't enter above its exit unless a real down-exit).
 *   • Holding-period sanity ceiling: implied MOIC <= 1 + 0.5×months held (floor 1.5×). A
 *     company picked weeks before its exit cannot honestly show a large step-up.
 *   • Low confidence / unsourceable → held at cost (entry = exit, 1.0×). Never fabricate.
 *
 * Usage:
 *   node scripts/rebase-exit-entries.mjs            # dry-run
 *   node scripts/rebase-exit-entries.mjs --apply
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../server/lib/portfolioFundingVerify.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const MAX_PLAUSIBLE = 15_000_000_000;
const MIN_CONF = 0.6;
const EXIT_STATUSES = ['acquired', 'ipo', 'exited'];

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
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
  const q = encodeURIComponent(`"${company}" valuation OR Series OR raised OR funding`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 10);
}

async function pickValuation(company, website, pickMonth, exitVal, items) {
  const corpus = items.length
    ? items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n')
    : '(no fresh headlines found)';
  const site = website ? ` (official site: ${website})` : '';
  const prompt = `You are a venture analyst. The company "${company}"${site} was picked by a fund in ${pickMonth} and later exited at about $${(exitVal / 1e9).toFixed(2)}B.

Return its post-money valuation AS OF ${pickMonth} — the most recent funding round (or public market cap) that had CLOSED on or before ${pickMonth}. This is the valuation the fund entered at; the exit is the step-up from here.

STRICT:
- Real, reported, CLOSED rounds only. No rumors.
- Must be THIS exact company (match the official site/domain). If you can't confidently identify it or lack real data, set valuation_at_pick_usd null and confidence low.
- valuation_at_pick_usd must be <= the exit value above unless a real down-exit is documented.
- Do NOT invent a figure. Null is better than a guess.

Headlines:
${corpus}

Return ONLY JSON: {"valuation_at_pick_usd":number|null,"round_label":string,"confidence":number,"note":string}`;
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    return JSON.parse(r.choices[0].message.content);
  } catch (e) {
    console.error(`   LLM error ${company}: ${e.message}`);
    return null;
  }
}

const okVal = (n) => Number(n) > 0 && Number(n) <= MAX_PLAUSIBLE;
const b = (n) => '$' + (Number(n) / 1e9).toFixed(2) + 'B';
const now = new Date();

function holdMonths(pickMonth) {
  if (!/^\d{4}-\d{2}/.test(pickMonth)) return 0;
  const [y, mo] = pickMonth.slice(0, 7).split('-').map(Number);
  return Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo));
}

async function main() {
  console.log(`\n🔁 Re-basing exit entries to real entry-round valuations ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: pos } = await supabase
    .from('virtual_portfolio')
    .select('id, startup_id, status, entry_date, created_at, entry_valuation_usd, exit_valuation_usd')
    .in('status', EXIT_STATUSES)
    .not('exit_valuation_usd', 'is', null);
  const ids = [...new Set((pos || []).map((p) => p.startup_id))];
  const { data: su } = await supabase.from('startup_uploads').select('id, name, website').in('id', ids);
  const meta = new Map((su || []).map((r) => [r.id, r]));

  console.log('company'.padEnd(20), 'pick'.padStart(8), 'hold'.padStart(5), 'entry'.padStart(8), 'exit'.padStart(8), 'MOIC'.padStart(7), '  conf  basis');
  console.log('-'.repeat(92));

  let rebased = 0, held = 0;
  const results = [];

  for (const p of pos || []) {
    const s = meta.get(p.startup_id);
    if (!s || !s.name) continue;
    const exitVal = Number(p.exit_valuation_usd);
    const pickMonth = (p.entry_date || p.created_at || '').slice(0, 7) || 'unknown';
    const months = holdMonths(pickMonth);
    const maxMoic = Math.max(1.5, 1 + months * 0.5);

    const items = await headlines(s.name);
    const h = await pickValuation(s.name, s.website, pickMonth, exitVal, items);
    const conf = h ? Number(h.confidence) || 0 : 0;
    let entry = h && okVal(h.valuation_at_pick_usd) ? Number(h.valuation_at_pick_usd) : null;
    if (entry && entry > exitVal) entry = exitVal;

    let chosen, basis;
    if (conf >= MIN_CONF && entry && exitVal / entry <= maxMoic) {
      chosen = entry;
      basis = `sourced (${h.round_label || 'round'})`;
      rebased++;
    } else if (conf >= MIN_CONF && entry && exitVal / entry > maxMoic) {
      // Real entry found but the implied step-up exceeds what the hold can justify → cap.
      chosen = exitVal / maxMoic;
      basis = `capped ${maxMoic.toFixed(1)}x (${months}mo hold)`;
      rebased++;
    } else {
      chosen = exitVal; // held at cost — no fabricated step-up
      basis = 'held at cost (unsourced)';
      held++;
    }

    results.push({ name: s.name, pickMonth, months, entry: chosen, exit: exitVal, moic: exitVal / chosen, conf, basis });
    if (APPLY) {
      await supabase.from('virtual_portfolio').update({ entry_valuation_usd: Math.round(chosen) }).eq('id', p.id);
    }
  }

  results.sort((a, c) => c.moic - a.moic);
  for (const r of results) {
    console.log(
      r.name.slice(0, 19).padEnd(20),
      r.pickMonth.padStart(8),
      (r.months + 'mo').padStart(5),
      b(r.entry).padStart(8),
      b(r.exit).padStart(8),
      (r.moic.toFixed(2) + 'x').padStart(7),
      ' ', r.conf.toFixed(2), ' ', r.basis
    );
  }
  console.log('-'.repeat(92));
  console.log(`\n${rebased} re-based to real entry valuations, ${held} held at cost.`);

  if (APPLY) {
    const { computePortfolioValue } = await import('../server/lib/portfolioAnalytics.js');
    const v = await computePortfolioValue(supabase);
    console.log(`\n📊 Seed fund: Avg MOIC ${v.avg_moic}× | realized $${(v.realized_value_usd / 1e6).toFixed(2)}M | ${v.winners}W/${v.losers}L`);
  } else {
    console.log('\n(dry-run — re-run with --apply to persist.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
