#!/usr/bin/env node
/**
 * RESTORE TRUE ENTRY DATES + VALUATIONS
 * =====================================
 * The Oracle's true first-flag date for each company is startup_uploads.created_at. A prior
 * re-ingestion reset virtual_portfolio.entry_date to ~5 months LATER (the row's re-add date),
 * compressing the hold to days and forcing late/large positions to 1.0× (entry was also set
 * equal to the current round). That erased real, earned multiples.
 *
 * This restores honesty for late/large positions (those with a verified round ≥ $100M):
 *   1. entry_date  ← earliest(startup_uploads.created_at, entry_date)   [true first-flag]
 *   2. entry_valuation_usd ← the post-money AS OF the first-flag month, re-sourced from press
 *      (the round that had closed on/before the Oracle flagged it).
 *   3. MOIC then = current round / first-flag valuation = the real step-up during our hold.
 *
 * Guards (no fudging):
 *   • 0 < entry <= current round.
 *   • Holding-period ceiling: implied MOIC <= max(2, 1 + 1.2×months held). A real ~6-month
 *     hold can show ~8×; a 2-week hold cannot show 10×. (Only raises the ceiling on SOURCED,
 *     verified step-ups — never the floor, never fabricated.)
 *   • Low confidence / unsourceable → entry held at current valuation (1×). Never fabricate.
 *   • Genuinely-early small picks (no ≥$100M round) are left untouched at their seed entry.
 *
 * Usage:
 *   node scripts/restore-true-entry-valuations.mjs            # dry-run
 *   node scripts/restore-true-entry-valuations.mjs --apply
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../server/lib/portfolioFundingVerify.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const MAX_PLAUSIBLE = 15_000_000_000;
const LATE_ROUND_FLOOR = 100_000_000; // only re-base late/large positions
const MIN_CONF = 0.55;

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
  const q = encodeURIComponent(`"${company}" valuation OR Series OR raised OR funding round`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 10);
}

async function flagValuation(company, website, flagMonth, currentVal, items) {
  const corpus = items.length
    ? items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n')
    : '(no fresh headlines found)';
  const site = website ? ` (official site: ${website})` : '';
  const prompt = `You are a venture analyst. A fund first flagged "${company}"${site} in ${flagMonth}. Its current valuation is about $${(currentVal / 1e9).toFixed(2)}B.

Return the company's post-money valuation AS OF ${flagMonth} — the most recent funding round (or public market cap) that had CLOSED on or before ${flagMonth}. This is the valuation the fund entered at; today's value is the step-up from here.

STRICT:
- Real, reported, CLOSED rounds only. No rumors or projections.
- Must be THIS exact company (match the official site/domain). If you can't confidently identify it or lack real data, set valuation_at_flag_usd null and confidence low.
- valuation_at_flag_usd must be <= the current value above (a company is generally smaller in the past).
- Do NOT invent a figure. Null is better than a guess.

Headlines:
${corpus}

Return ONLY JSON: {"valuation_at_flag_usd":number|null,"round_label":string,"confidence":number,"note":string}`;
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

function monthsBetween(fromIso) {
  const d = new Date(fromIso);
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

async function main() {
  console.log(`\n🕰️  Restoring true entry dates + valuations ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: vp } = await supabase
    .from('virtual_portfolio')
    .select('id, startup_id, status, entry_date, entry_valuation_usd, current_valuation_usd');
  const ids = (vp || []).map((p) => p.startup_id);
  const { data: su } = await supabase.from('startup_uploads').select('id, name, website, created_at').in('id', ids);
  const meta = new Map((su || []).map((r) => [r.id, r]));

  // Latest verified plausible round per startup → "current" value anchor.
  const { data: ev } = await supabase
    .from('portfolio_events')
    .select('startup_id, post_money_usd, event_date, verified')
    .eq('event_type', 'funding_round')
    .eq('verified', true);
  const roundByStartup = new Map();
  for (const e of ev || []) {
    const pm = Number(e.post_money_usd);
    if (pm > 0 && pm <= MAX_PLAUSIBLE) roundByStartup.set(e.startup_id, Math.max(roundByStartup.get(e.startup_id) || 0, pm));
  }

  // Only late/large positions get re-based; small early picks keep their seed entry.
  const targets = (vp || []).filter((p) => (roundByStartup.get(p.startup_id) || 0) >= LATE_ROUND_FLOOR);
  console.log(`${targets.length} late/large positions (verified round ≥ $${LATE_ROUND_FLOOR / 1e6}M) to evaluate.\n`);

  console.log('company'.padEnd(18), 'flag'.padStart(8), 'hold'.padStart(5), 'entry→'.padStart(9), 'current'.padStart(9), 'MOIC'.padStart(7), '  conf  basis');
  console.log('-'.repeat(96));

  let rebased = 0, held = 0, dateFixed = 0;
  const results = [];

  for (const p of targets) {
    const m = meta.get(p.startup_id);
    if (!m || !m.name) continue;
    const currentVal = roundByStartup.get(p.startup_id) || Number(p.current_valuation_usd) || 0;
    if (!(currentVal > 0)) continue;

    // True first-flag date = earliest of upload created_at and current entry_date.
    const uploadMs = m.created_at ? new Date(m.created_at).getTime() : Infinity;
    const entryMs = p.entry_date ? new Date(p.entry_date).getTime() : Infinity;
    const trueEntryIso = (uploadMs < entryMs ? m.created_at : p.entry_date) || m.created_at;
    const flagMonth = (trueEntryIso || '').slice(0, 7) || 'unknown';
    const months = monthsBetween(trueEntryIso);
    const maxMoic = Math.max(2, 1 + months * 1.2);
    const willFixDate = uploadMs < entryMs - 30 * 86400000;

    const items = await headlines(m.name);
    const h = await flagValuation(m.name, m.website, flagMonth, currentVal, items);
    const conf = h ? Number(h.confidence) || 0 : 0;
    let entry = h && okVal(h.valuation_at_flag_usd) ? Number(h.valuation_at_flag_usd) : null;
    if (entry && entry > currentVal) entry = currentVal;

    let chosen, basis;
    if (conf >= MIN_CONF && entry && currentVal / entry <= maxMoic) {
      chosen = entry;
      basis = `sourced (${h.round_label || 'round'})`;
      rebased++;
    } else if (conf >= MIN_CONF && entry && currentVal / entry > maxMoic) {
      chosen = currentVal / maxMoic;
      basis = `capped ${maxMoic.toFixed(1)}× (${months}mo)`;
      rebased++;
    } else {
      chosen = currentVal; // held at cost — no fabricated step-up
      basis = 'held at cost (unsourced)';
      held++;
    }
    if (willFixDate) dateFixed++;

    results.push({ name: m.name, flagMonth, months, entry: chosen, current: currentVal, moic: currentVal / chosen, conf, basis, willFixDate, trueEntryIso, id: p.id });

    if (APPLY) {
      const upd = { entry_valuation_usd: Math.round(chosen) };
      if (willFixDate) upd.entry_date = trueEntryIso;
      await supabase.from('virtual_portfolio').update(upd).eq('id', p.id);
    }
  }

  results.sort((a, c) => c.moic - a.moic);
  for (const r of results) {
    console.log(
      r.name.slice(0, 17).padEnd(18),
      r.flagMonth.padStart(8),
      (r.months + 'mo').padStart(5),
      b(r.entry).padStart(9),
      b(r.current).padStart(9),
      (r.moic.toFixed(2) + '×').padStart(7),
      ' ', r.conf.toFixed(2), ' ', r.basis, r.willFixDate ? '  [date fixed]' : ''
    );
  }
  console.log('-'.repeat(96));
  console.log(`\n${rebased} re-based to real first-flag valuations, ${held} held at cost, ${dateFixed} entry_dates corrected.`);

  if (APPLY) {
    const { computePortfolioValue } = await import('../server/lib/portfolioAnalytics.js');
    const v = await computePortfolioValue(supabase);
    console.log(`\n📊 Seed fund: TVPI ${v.tvpi}× | Avg MOIC ${v.avg_moic}× | value $${(v.current_value_usd / 1e6).toFixed(2)}M | ${v.winners}W/${v.losers}L | entered-late ${v.entered_late_positions}`);
  } else {
    console.log('\n(dry-run — re-run with --apply to persist.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
