#!/usr/bin/env node
/**
 * RECONCILE REALIZED EXITS (capture liquidity value honestly)
 * ===========================================================
 * The daily signal tracker records 'acquisition'/'ipo' EVENTS but never books them as
 * realized exits, so genuine liquidity value is left on the table — and some are stuck
 * marked 'acquired' with a null exit valuation (held at cost). This reconciler:
 *
 *   1. LLM-verifies, per company, whether THIS company was actually the TARGET (acquired /
 *      went public) — NOT the acquirer (e.g. LaunchDarkly/Branch/Baseten often acquire
 *      others; those must not be booked as exits).
 *   2. Sources the real DEAL value (acquisition price / IPO valuation) from press.
 *   3. Books the exit on the seed position (and any follow-on) at that value, against the
 *      position's existing HONEST entry — so MOIC reflects the real realized multiple.
 *
 * Guards (no fudging): is_target required, confidence >= 0.6, deal value in (0, $15B].
 * Unverifiable or acquirer-side events are skipped (no exit booked).
 *
 * Usage:
 *   node scripts/reconcile-portfolio-exits.mjs            # dry-run
 *   node scripts/reconcile-portfolio-exits.mjs --apply
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
const CONCURRENCY = 4;

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
  const q = encodeURIComponent(`"${company}" acquired OR acquisition OR IPO OR "goes public" OR "taken private"`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 10);
}

async function verifyExit(company, website, items) {
  const corpus = items.length
    ? items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 200) : ''}`).join('\n')
    : '(no fresh headlines found)';
  const site = website ? ` (official site: ${website})` : '';
  const prompt = `You are an M&A analyst. Determine whether the company "${company}"${site} has had a REALIZED EXIT.

A realized exit means THIS company was ACQUIRED (it is the target/seller) or went PUBLIC (IPO/direct listing) or was TAKEN PRIVATE. It is NOT an exit if this company merely ACQUIRED another company (then it is the buyer, not the target).

Return:
- exited: true only if THIS company was the target of an acquisition, or IPO'd, or was taken private.
- is_target: true if this company is the one being acquired/sold (not the acquirer).
- exit_type: "acquisition" | "ipo" | "secondary" | null.
- deal_value_usd: the acquisition price / IPO (or take-private) valuation in USD, or null if not reported.
- valuation_before_exit_usd: the company's most recent valuation BEFORE this exit — its last private round post-money, or public market cap just before a take-private/IPO. Null if unknown.
- acquirer: name of the buyer (for acquisitions), or null.
- exit_date: approximate ISO date (YYYY-MM-DD) of the exit, or null.
- confidence: 0-1 that this is a REAL, reported exit for THIS exact company (match the official site/domain; reject namesakes).

STRICT:
- If the company is the ACQUIRER (it bought someone), set exited=false, is_target=false.
- Real, reported, CLOSED/announced deals only. Ignore rumors / "in talks" / "exploring".
- Do NOT invent a deal value. Null is fine.
- valuation_before_exit_usd must be <= deal_value_usd unless a real down-exit is documented.

Headlines:
${corpus}

Return ONLY JSON: {"exited":bool,"is_target":bool,"exit_type":string|null,"deal_value_usd":number|null,"valuation_before_exit_usd":number|null,"acquirer":string|null,"exit_date":string|null,"confidence":number,"note":string}`;
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
const m = (n) => (n == null ? '—' : '$' + (Number(n) / 1e9).toFixed(2) + 'B');
const STATUS = { acquisition: 'acquired', ipo: 'ipo', secondary: 'exited' };

async function main() {
  console.log(`\n💰 Reconciling realized exits ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  // Companies with an M&A / IPO event.
  const { data: ev } = await supabase
    .from('portfolio_events')
    .select('startup_id, event_type')
    .in('event_type', ['acquisition', 'ipo']);
  const startupIds = [...new Set((ev || []).map((e) => e.startup_id).filter(Boolean))];

  const { data: su } = await supabase.from('startup_uploads').select('id, name, website').in('id', startupIds);
  const meta = new Map((su || []).map((r) => [r.id, r]));

  // Seed + follow-on positions for those companies.
  const { data: seed } = await supabase
    .from('virtual_portfolio')
    .select('id, startup_id, status, entry_valuation_usd')
    .in('startup_id', startupIds);
  const seedByStartup = new Map((seed || []).map((r) => [r.startup_id, r]));
  const { data: foll } = await supabase
    .from('virtual_followon_portfolio')
    .select('id, startup_id, status, entry_valuation_usd')
    .in('startup_id', startupIds);
  const follByStartup = new Map((foll || []).map((r) => [r.startup_id, r]));

  const EXIT_STATUSES = new Set(['acquired', 'ipo', 'exited']);
  const rows = startupIds
    .map((id) => ({ id, su: meta.get(id) }))
    .filter((r) => r.su && r.su.name)
    // Skip positions already booked as exits — avoids redundant LLM calls on daily runs.
    .filter((r) => {
      const sp = seedByStartup.get(r.id);
      const fp = follByStartup.get(r.id);
      const seedDone = sp && EXIT_STATUSES.has(sp.status);
      const follDone = !fp || EXIT_STATUSES.has(fp.status);
      return !(seedDone && follDone);
    });

  console.log('company'.padEnd(22), 'verdict'.padEnd(14), 'entry'.padStart(8), 'deal'.padStart(8), 'MOIC'.padStart(8), '  conf');
  console.log('-'.repeat(84));

  let booked = 0, skipped = 0;
  const results = [];

  async function one({ id, su }) {
    const items = await headlines(su.name);
    const v = await verifyExit(su.name, su.website, items);
    if (!v) { skipped++; return; }
    const conf = Number(v.confidence) || 0;

    if (!v.exited || !v.is_target || conf < MIN_CONF || !okVal(v.deal_value_usd)) {
      skipped++;
      results.push({
        name: su.name,
        verdict: !v.is_target ? 'acquirer/skip' : !v.exited ? 'no exit' : !okVal(v.deal_value_usd) ? 'no deal $' : 'low conf',
        deal: v.deal_value_usd, moic: null, conf,
      });
      return;
    }

    const deal = Number(v.deal_value_usd);
    const exitType = v.exit_type && STATUS[v.exit_type] ? v.exit_type : 'acquisition';
    const status = STATUS[exitType];
    const exitDate = v.exit_date || new Date().toISOString().slice(0, 10);

    const seedPos = seedByStartup.get(id);
    // Honest entry: a position only shows a realized multiple if we have the company's real
    // pre-exit valuation; otherwise it is realized AT COST (entry = deal, 1.0×). This avoids
    // a counterfactual multiple off the placeholder $12M seed for late-flagged mature names.
    const existingEntry = seedPos ? Number(seedPos.entry_valuation_usd) || 0 : 0;
    const preExit = okVal(v.valuation_before_exit_usd) ? Math.min(Number(v.valuation_before_exit_usd), deal) : 0;
    // Treat a tiny placeholder seed entry (< 5% of deal) as "no real basis" → use pre-exit
    // or fall back to cost. Keep a genuinely large existing entry if present.
    const placeholder = existingEntry > 0 && existingEntry < deal * 0.05;
    let honestEntry;
    if (preExit > 0) honestEntry = preExit;
    else if (existingEntry > 0 && !placeholder) honestEntry = existingEntry;
    else honestEntry = deal; // realized at cost — no fabricated premium
    const seedMoic = honestEntry > 0 ? Math.min(deal / honestEntry, 50) : null;

    results.push({ name: su.name, verdict: `EXIT (${exitType})`, deal, entry: honestEntry, moic: seedMoic, conf, acquirer: v.acquirer });

    if (APPLY) {
      if (seedPos) {
        const upd = {
          status, exit_type: exitType, exit_valuation_usd: Math.round(deal),
          exit_date: exitDate, exit_acquirer: v.acquirer || null,
          entry_valuation_usd: Math.round(honestEntry),
        };
        await supabase.from('virtual_portfolio').update(upd).eq('id', seedPos.id);
      }
      const f = follByStartup.get(id);
      if (f) {
        await supabase.from('virtual_followon_portfolio').update({
          status, exit_type: exitType, exit_valuation_usd: Math.round(deal), exit_date: exitDate,
        }).eq('id', f.id);
      }
    }
    booked++;
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.allSettled(rows.slice(i, i + CONCURRENCY).map(one));
    await new Promise((r) => setTimeout(r, 300));
  }

  results.sort((a, b) => (b.moic || 0) - (a.moic || 0));
  for (const r of results) {
    console.log(
      r.name.slice(0, 21).padEnd(22),
      r.verdict.padEnd(14),
      m(r.entry).padStart(8),
      m(r.deal).padStart(8),
      (r.moic ? r.moic.toFixed(2) + 'x' : '—').padStart(8),
      ' ', r.conf.toFixed(2),
      r.acquirer ? ' · ' + r.acquirer : ''
    );
  }
  console.log('-'.repeat(84));
  console.log(`\n${booked} exit(s) ${APPLY ? 'booked' : 'to book'}, ${skipped} skipped (acquirer/unverified/no deal value).`);

  if (APPLY) {
    const { computePortfolioValue } = await import('../server/lib/portfolioAnalytics.js');
    const { computeFollowOnValue } = await import('../server/lib/followOnAnalytics.js');
    const sv = await computePortfolioValue(supabase);
    const fv = await computeFollowOnValue(supabase);
    console.log(`\n📊 Seed fund:      Avg MOIC ${sv.avg_moic}× | realized $${(sv.realized_value_usd / 1e6).toFixed(1)}M | ${sv.winners}W/${sv.losers}L`);
    console.log(`📊 Follow-on fund: Avg MOIC ${fv.avg_moic}× | ${fv.positions} positions`);
  } else {
    console.log('\n(dry-run — re-run with --apply to book exits.)');
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
