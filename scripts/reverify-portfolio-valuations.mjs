#!/usr/bin/env node
/**
 * RE-SOURCE PORTFOLIO VALUATIONS (anti-fudge)
 * ===========================================
 * The original scraper stored post-money valuations by regex over Google News
 * snippets. That produced impossible figures (e.g. Baseten "$61B", Infravision
 * "$37B") because the regex grabbed market-size numbers or rumored ("in talks")
 * rounds. This pass re-extracts the REAL, CLOSED round valuation from fresh press
 * headlines using an LLM, then corrects portfolio_events.post_money_usd.
 *
 * Rules (LP-grade integrity):
 *   • Only CLOSED rounds count. Rumored / "in talks" / "eyes" / "considering" → ignored.
 *   • Company name must actually match the headline subject.
 *   • post_money must be plausible: 0 < post_money <= $15B and post_money >= amount.
 *   • If press reports only an amount (no valuation) → we DO NOT fabricate a post-money.
 *     post_money_usd is set NULL so the position holds at cost (honest), keeping amount.
 *   • Nothing credible found → post_money_usd set NULL (held at cost), event kept.
 *
 * Usage:
 *   node scripts/reverify-portfolio-valuations.mjs            # dry-run (default), all marked positions
 *   node scripts/reverify-portfolio-valuations.mjs --apply    # write corrections
 *   node scripts/reverify-portfolio-valuations.mjs --limit 5  # sample
 *   node scripts/reverify-portfolio-valuations.mjs --name Baseten   # single company
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

const MAX_PLAUSIBLE = 15_000_000_000;
const FETCH_TIMEOUT_MS = 10_000;

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

function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pythh-PortfolioBot/1.0)' }, timeout: timeoutMs },
      (res) => {
        let b = '';
        res.on('data', (d) => {
          b += d;
          if (b.length > 300_000) { req.destroy(); resolve(b); }
        });
        res.on('end', () => resolve(b));
      }
    );
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

async function freshHeadlines(company) {
  const q = encodeURIComponent(`"${company}" funding OR raises OR valuation OR Series`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 8);
}

async function extractValuation(company, items) {
  if (!items.length) return null;
  const corpus = items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n');
  const prompt = `You are a venture analyst verifying funding data for "${company}".
From the headlines below, identify the company's MOST RECENT CLOSED funding round.

STRICT RULES:
- ONLY count rounds that have CLOSED. Ignore anything rumored / "in talks" / "eyes" / "considering" / "plans to raise".
- The headline MUST be about "${company}" (the startup), not a different company or a market-size figure.
- post_money_usd = the company's valuation AFTER the round, in USD (numeric). Null if not explicitly stated.
- amount_usd = the amount raised in the round, in USD (numeric). Null if not stated.
- Do NOT estimate or infer a valuation that is not explicitly reported.

Headlines:
${corpus}

Return ONLY JSON: {"matched":bool,"closed":bool,"amount_usd":number|null,"post_money_usd":number|null,"round_type":string|null,"headline":string|null,"source":string|null}`;

  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    return JSON.parse(r.choices[0].message.content);
  } catch (e) {
    console.error(`   LLM error for ${company}: ${e.message}`);
    return null;
  }
}

function decide(ex) {
  if (!ex || !ex.matched || !ex.closed) return { post: null, reason: 'no closed round found' };
  const post = Number(ex.post_money_usd);
  const amt = Number(ex.amount_usd);
  if (!(post > 0)) return { post: null, amount: amt > 0 ? amt : null, reason: 'amount only, no valuation reported' };
  if (post > MAX_PLAUSIBLE) return { post: null, amount: amt > 0 ? amt : null, reason: `reported $${(post / 1e9).toFixed(1)}B exceeds plausibility ceiling` };
  if (amt > 0 && post < amt) return { post: null, amount: amt, reason: 'post-money < amount (inconsistent)' };
  return { post, amount: amt > 0 ? amt : null, round: ex.round_type || null, headline: ex.headline || null, source: ex.source || null, reason: 'corrected from press' };
}

const m = (n) => (n == null ? '—' : '$' + (Number(n) / 1e6).toFixed(0) + 'M');

async function main() {
  console.log(`\n🔎 Re-sourcing portfolio valuations from live press ${APPLY ? '(APPLY — writing)' : '(dry-run)'}\n`);
  const client = sb();

  const { data: picks } = await client
    .from('virtual_portfolio')
    .select('id, startup_id, entry_valuation_usd, status');
  const ids = [...new Set((picks || []).map((p) => p.startup_id).filter(Boolean))];
  const nameById = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await client.from('startup_uploads').select('id, name').in('id', ids.slice(i, i + 200));
    (data || []).forEach((r) => nameById.set(r.id, r.name));
  }

  const { data: events } = await client
    .from('portfolio_events')
    .select('id, startup_id, post_money_usd, amount_usd, round_type, event_date, verified')
    .eq('event_type', 'funding_round')
    .eq('verified', true)
    .order('event_date', { ascending: false });

  const latestByStartup = new Map();
  for (const e of events || []) {
    if (!latestByStartup.has(e.startup_id)) latestByStartup.set(e.startup_id, e);
  }

  // Candidates: positions whose latest verified round carries a post-money (these drive MOIC).
  let candidates = (picks || [])
    .map((p) => ({ p, name: nameById.get(p.startup_id), ev: latestByStartup.get(p.startup_id) }))
    .filter((c) => c.name && c.ev && Number(c.ev.post_money_usd) > 0);
  if (ONLY_NAME) candidates = candidates.filter((c) => c.name.toLowerCase().includes(ONLY_NAME.toLowerCase()));
  candidates = candidates.slice(0, LIMIT);

  console.log(`Checking ${candidates.length} marked position(s)…\n`);
  console.log('company'.padEnd(24), 'old post'.padStart(10), 'new post'.padStart(10), '  decision');
  console.log('-'.repeat(78));

  let corrected = 0, nulled = 0, unchanged = 0;
  for (const c of candidates) {
    const items = await freshHeadlines(c.name);
    const ex = await extractValuation(c.name, items);
    const d = decide(ex);
    const oldPost = Number(c.ev.post_money_usd);

    let newPost = d.post; // may be null
    let tag;
    if (newPost == null) { tag = `⤓ NULL (cost) — ${d.reason}`; nulled++; }
    else if (Math.abs(newPost - oldPost) / oldPost < 0.1) { tag = `= keep — ${d.reason}`; unchanged++; }
    else { tag = `✎ ${d.reason}`; corrected++; }

    console.log(c.name.slice(0, 23).padEnd(24), m(oldPost).padStart(10), m(newPost).padStart(10), ' ', tag);

    if (APPLY) {
      const upd = { post_money_usd: newPost };
      if (d.amount != null) upd.amount_usd = d.amount;
      if (d.round) upd.round_type = d.round;
      await client.from('portfolio_events').update(upd).eq('id', c.ev.id);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log('-'.repeat(78));
  console.log(`\nResult: ${corrected} corrected, ${nulled} nulled→cost, ${unchanged} unchanged.`);

  if (APPLY) {
    const v = await computePortfolioValue(client);
    console.log(`\n📊 Portfolio after re-sourcing: Avg MOIC ${v.avg_moic_capped}× | marked ${v.marked_positions}/${v.positions} | quarantined ${v.quarantined_positions}`);
  } else {
    console.log('\n(dry-run — no writes. Re-run with --apply to persist, then MOIC will be recomputed.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
