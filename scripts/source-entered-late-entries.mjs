#!/usr/bin/env node
/**
 * SOURCE HONEST ENTRY VALUATIONS FOR ENTERED-LATE PICKS
 * =====================================================
 * Some picks were already mid/late stage when the Oracle flagged them (a real,
 * verified round ≥ $500M). For those, the fund's assumed ~$12M seed entry is
 * counterfactual. This script sets an HONEST entry for each: the company's real
 * post-money valuation AS OF its pick date (most recent round closed on/before
 * entry_date). MOIC then reflects ONLY appreciation since Pythia picked it.
 *
 * Fallback (no fudging): if a pick-date valuation can't be confidently sourced,
 * the position is held FLAT at its current valuation (1×) — never left at $12M.
 *
 * After this, every position has an honest entry (early picks = assumed seed,
 * entered-late = real pick-date valuation) so the headline can be a single
 * blended Avg MOIC with no exclusions.
 *
 * Usage:
 *   node scripts/source-entered-late-entries.mjs            # dry-run
 *   node scripts/source-entered-late-entries.mjs --apply
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../server/lib/portfolioFundingVerify.js';
import { computePortfolioValue } from '../server/lib/portfolioAnalytics.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const THRESHOLD = 200_000_000;
const MAX_PLAUSIBLE = 15_000_000_000;
const MIN_CONF = 0.6;
const CONCURRENCY = 4;

const client = createClient(
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
  const q = encodeURIComponent(`"${company}" valuation OR raises OR Series OR funding`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 10);
}

async function pickDateValuation(company, website, pickMonth, current, items) {
  const corpus = items.length
    ? items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n')
    : '(no fresh headlines found)';
  const site = website ? ` (official site: ${website})` : '';
  const prompt = `You are a venture analyst. The company "${company}"${site} was added to a fund's books on ${pickMonth}. Its most recent reported post-money valuation is about $${(current / 1e9).toFixed(2)}B.

Using the company's REAL, publicly-reported funding history, return its post-money valuation AS OF ${pickMonth}: the most recent funding round that had CLOSED on or before ${pickMonth}. This is the valuation the fund effectively entered at.

STRICT:
- Real, reported, CLOSED rounds only. Ignore rumored / "in talks" valuations.
- Must be THIS exact company (match the official site/domain). If you cannot confidently identify it or lack real historical data, set valuation_at_pick_usd null and confidence low.
- Do NOT invent a figure. It is better to return null than to guess.
- valuation_at_pick_usd must be <= the current valuation above (a company can't have been worth more at an earlier round unless there was a real down round — only report a higher earlier figure if a down round is actually documented).

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

const ok = (n) => Number(n) > 0 && Number(n) <= MAX_PLAUSIBLE;
const b = (n) => '$' + (Number(n) / 1e9).toFixed(2) + 'B';

async function main() {
  console.log(`\n💼 Sourcing honest entry valuations for entered-late picks ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  // Current valuation = max verified round per startup, in [THRESHOLD, MAX].
  const { data: ev } = await client
    .from('portfolio_events')
    .select('startup_id, post_money_usd')
    .eq('event_type', 'funding_round')
    .eq('verified', true)
    .gte('post_money_usd', THRESHOLD)
    .lte('post_money_usd', MAX_PLAUSIBLE);
  const currentByStartup = new Map();
  for (const e of ev || []) {
    const v = Number(e.post_money_usd);
    if (!e.startup_id || !(v > 0)) continue;
    if (!currentByStartup.has(e.startup_id) || v > currentByStartup.get(e.startup_id)) {
      currentByStartup.set(e.startup_id, v);
    }
  }

  const ids = [...currentByStartup.keys()];
  const { data: picks } = await client
    .from('virtual_portfolio')
    .select('id, startup_id, entry_valuation_usd, entry_date, created_at, status')
    .in('startup_id', ids);
  const { data: sus } = await client.from('startup_uploads').select('id, name, website').in('id', ids);
  const meta = new Map((sus || []).map((r) => [r.id, r]));

  const rows = (picks || [])
    .filter((p) => p.status !== 'written_off' && p.status !== 'dead' && meta.get(p.startup_id))
    .map((p) => ({ p, su: meta.get(p.startup_id), current: currentByStartup.get(p.startup_id) }));

  console.log('company'.padEnd(22), 'pick'.padStart(8), 'entry@pick'.padStart(11), 'current'.padStart(9), 'moic'.padStart(7), '  conf  basis');
  console.log('-'.repeat(86));

  let sourced = 0, heldFlat = 0;
  const results = [];
  const now = new Date();

  async function one({ p, su, current }) {
    const pickMonth = (p.entry_date || p.created_at || '').slice(0, 7) || 'unknown';
    const items = await headlines(su.name);
    const h = await pickDateValuation(su.name, su.website, pickMonth, current, items);
    const conf = h ? Number(h.confidence) || 0 : 0;
    let entry = h && ok(h.valuation_at_pick_usd) ? Number(h.valuation_at_pick_usd) : null;

    // Guard: entry can't exceed current (unless a real down round — we don't allow it here).
    if (entry && entry > current) entry = current;

    // Holding-period sanity: a company picked N months ago can't plausibly have grown
    // by an outsized multiple since pick. Cap implied MOIC at ~1 + 0.5×months (≈3x/yr,
    // floor 1.5x). Rejects artifacts like a $10M "revenue valuation" → 69× on a pick
    // made this month. Over the cap → the sourced entry is unreliable; hold flat.
    let holdingMonths = 0;
    if (/^\d{4}-\d{2}$/.test(pickMonth)) {
      const [y, mo] = pickMonth.split('-').map(Number);
      holdingMonths = Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo));
    }
    const maxPlausibleMoic = Math.max(1.5, 1 + holdingMonths * 0.5);

    let chosen, basis;
    if (conf >= MIN_CONF && entry && current / entry <= maxPlausibleMoic) {
      chosen = entry;
      basis = `sourced (${h.round_label || 'round'})`;
      sourced++;
    } else {
      chosen = current; // conservative: held flat at current (1×), never $12M
      basis = entry && current / entry > maxPlausibleMoic
        ? `held flat (1×, ${(current / entry).toFixed(0)}× implausible for ${holdingMonths}mo hold)`
        : 'held flat (1×, unsourced)';
      heldFlat++;
    }

    results.push({ name: su.name, pickMonth, entry: chosen, current, moic: current / chosen, conf, basis });

    if (APPLY) {
      await client.from('virtual_portfolio')
        .update({ entry_valuation_usd: Math.round(chosen) })
        .eq('id', p.id);
    }
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.allSettled(rows.slice(i, i + CONCURRENCY).map(one));
    await new Promise((r) => setTimeout(r, 300));
  }

  results.sort((a, c) => c.moic - a.moic);
  for (const r of results) {
    console.log(
      r.name.slice(0, 21).padEnd(22),
      r.pickMonth.padStart(8),
      b(r.entry).padStart(11),
      b(r.current).padStart(9),
      (r.moic.toFixed(2) + 'x').padStart(7),
      ' ', r.conf.toFixed(2), ' ', r.basis
    );
  }
  console.log('-'.repeat(86));
  console.log(`\n${sourced} sourced real pick-date entries, ${heldFlat} held flat at current (1×).`);

  if (APPLY) {
    const v = await computePortfolioValue(client);
    console.log(`\n📊 Portfolio after honest entries:`);
    console.log(`   Blended Avg MOIC (all ${v.positions}): ${v.avg_moic_capped}×`);
    console.log(`   Early-only (${v.early_positions}):      ${v.avg_moic_early}×`);
    console.log(`   Entered-late (${v.entered_late_positions}):    ${v.entered_late_avg_moic}×`);
    console.log(`   TVPI: ${v.tvpi}× | above cost ${v.marked_positions}/${v.positions} | current $${(v.current_value_usd / 1e6).toFixed(1)}M`);
  } else {
    console.log('\n(dry-run — re-run with --apply to persist.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
