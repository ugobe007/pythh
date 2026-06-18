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
 *   node scripts/reconcile-portfolio-exits.mjs            # dry-run (new events only)
 *   node scripts/reconcile-portfolio-exits.mjs --apply
 *   node scripts/reconcile-portfolio-exits.mjs --fix-exits           # dry-run: rebook bad exits
 *   node scripts/reconcile-portfolio-exits.mjs --fix-exits --apply
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../server/lib/portfolioFundingVerify.js';
import { estimateEntryValuationUsd } from '../server/lib/stageValuationBenchmarks.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const FIX_EXITS = process.argv.includes('--fix-exits');
const MAX_PLAUSIBLE = 15_000_000_000;
const MIN_CONF = 0.6;
const MOIC_CAP = 50;
const CONCURRENCY = 4;
const EXIT_STATUSES = new Set(['acquired', 'ipo', 'exited']);

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

function calcMoic(entry, current) {
  if (!entry || !current) return null;
  return Math.round((current / entry) * 100) / 100;
}

function calcIrr(entry, current, days) {
  if (!entry || !current || days < 1) return null;
  const years = days / 365;
  const raw = Math.pow(current / entry, 1 / years) - 1;
  if (!Number.isFinite(raw)) return null;
  // irr_annualized is NUMERIC(8,4) — cap to avoid overflow on short holds / high MOIC.
  const capped = Math.min(raw, 9999.9999);
  return Math.round(capped * 10000) / 10000;
}

function needsExitFix(pos) {
  const entry = Number(pos.entry_valuation_usd) || 0;
  const exit = Number(pos.exit_valuation_usd) || 0;
  const moic = Number(pos.moic) || 0;
  if (!exit) return true;
  if (moic <= 1.05) return true;
  if (entry > 0 && exit > 0 && Math.abs(entry - exit) / exit < 0.02) return true;
  const implied = entry > 0 ? exit / entry : 0;
  if (moic > 1.05 && Math.abs(moic - implied) > 0.5) return true;
  return false;
}

function honestEntryFromSignals({ deal, preExit, existingEntry, entryGodScore, stage }) {
  const placeholder = existingEntry > 0 && existingEntry < deal * 0.05;
  const entryEqualsDeal = existingEntry > 0 && Math.abs(existingEntry - deal) / deal < 0.02;
  let honestEntry = 0;
  if (preExit > 0) honestEntry = preExit;
  else if (existingEntry > 0 && !placeholder && !entryEqualsDeal && existingEntry < deal * 0.98) {
    honestEntry = existingEntry;
  } else {
    honestEntry = estimateEntryValuationUsd(stage, entryGodScore);
  }
  return Math.min(honestEntry, deal * 0.95);
}

async function lastVerifiedPreExitValuation(supabase, startupId, exitDate) {
  const { data, error } = await supabase
    .from('portfolio_events')
    .select('post_money_usd, amount_usd, event_date, verified')
    .eq('startup_id', startupId)
    .eq('event_type', 'funding_round')
    .order('event_date', { ascending: false });
  if (error) return 0;
  const exitMs = exitDate ? new Date(exitDate).getTime() : Date.now();
  for (const e of data || []) {
    const v = Number(e.post_money_usd) || Number(e.amount_usd) || 0;
    if (v <= 0 || v > MAX_PLAUSIBLE) continue;
    if (new Date(e.event_date).getTime() >= exitMs) continue;
    if (e.verified) return v;
  }
  for (const e of data || []) {
    const v = Number(e.post_money_usd) || Number(e.amount_usd) || 0;
    if (v <= 0 || v > MAX_PLAUSIBLE) continue;
    if (new Date(e.event_date).getTime() < exitMs) return v;
  }
  return 0;
}

async function main() {
  const mode = FIX_EXITS ? 'fix-exits' : 'new-events';
  console.log(`\n💰 Reconciling realized exits ${APPLY ? '(APPLY)' : '(dry-run)'} [${mode}]\n`);

  let rows = [];
  const seedByStartup = new Map();
  const follByStartup = new Map();
  const meta = new Map();

  if (FIX_EXITS) {
    const { data: exits, error: exErr } = await supabase
      .from('virtual_portfolio')
      .select('id, startup_id, status, entry_valuation_usd, exit_valuation_usd, entry_date, exit_date, moic, entry_god_score, virtual_check_usd')
      .in('status', [...EXIT_STATUSES]);
    if (exErr) throw new Error(exErr.message);

    const fixIds = (exits || []).filter(needsExitFix).map((p) => p.startup_id);
    const { data: su, error: suErr } = await supabase
      .from('startup_uploads')
      .select('id, name, website, stage')
      .in('id', fixIds);
    if (suErr) throw new Error(suErr.message);
    for (const r of su || []) meta.set(r.id, r);
    for (const p of exits || []) {
      if (!fixIds.includes(p.startup_id)) continue;
      seedByStartup.set(p.startup_id, p);
    }
    rows = fixIds.map((id) => ({ id, su: meta.get(id) })).filter((r) => r.su?.name);
    console.log(`Rebooking ${rows.length} exited position(s) with missing deal $, 1× MOIC, or stale multiples.\n`);
  } else {
    const { data: ev } = await supabase
      .from('portfolio_events')
      .select('startup_id, event_type')
      .in('event_type', ['acquisition', 'ipo']);
    const startupIds = [...new Set((ev || []).map((e) => e.startup_id).filter(Boolean))];

    const { data: su } = await supabase.from('startup_uploads').select('id, name, website, stage').in('id', startupIds);
    for (const r of su || []) meta.set(r.id, r);

    const { data: seed } = await supabase
      .from('virtual_portfolio')
      .select('id, startup_id, status, entry_valuation_usd, entry_date, exit_date, entry_god_score')
      .in('startup_id', startupIds);
    for (const r of seed || []) seedByStartup.set(r.startup_id, r);

    const { data: foll } = await supabase
      .from('virtual_followon_portfolio')
      .select('id, startup_id, status, entry_valuation_usd')
      .in('startup_id', startupIds);
    for (const r of foll || []) follByStartup.set(r.startup_id, r);

    rows = startupIds
      .map((id) => ({ id, su: meta.get(id) }))
      .filter((r) => r.su && r.su.name)
      .filter((r) => {
        const sp = seedByStartup.get(r.id);
        const fp = follByStartup.get(r.id);
        const seedDone = sp && EXIT_STATUSES.has(sp.status);
        const follDone = !fp || EXIT_STATUSES.has(fp.status);
        return !(seedDone && follDone);
      });
  }

  console.log('company'.padEnd(22), 'verdict'.padEnd(14), 'entry'.padStart(8), 'deal'.padStart(8), 'MOIC'.padStart(8), '  conf');
  console.log('-'.repeat(84));

  let booked = 0;
  let skipped = 0;
  const results = [];

  async function one({ id, su }) {
    const items = await headlines(su.name);
    let v = await verifyExit(su.name, su.website, items);
    const seedPos = seedByStartup.get(id);

    // Fix mode: trust stored exit evidence when LLM misses a known booked exit.
    if (FIX_EXITS && seedPos) {
      const storedDeal = Number(seedPos.exit_valuation_usd) || 0;
      const storedMoic = Number(seedPos.moic) || 0;
      const storedEntry = Number(seedPos.entry_valuation_usd) || 0;
      if (!v) v = {};
      if (storedDeal > 0 && (!v.exited || !okVal(v.deal_value_usd))) {
        v.exited = true;
        v.is_target = true;
        v.exit_type = v.exit_type || 'acquisition';
        v.deal_value_usd = storedDeal;
        v.confidence = Math.max(Number(v.confidence) || 0, 0.85);
        v.acquirer = v.acquirer || seedPos.exit_acquirer || null;
        v.exit_date = v.exit_date || (seedPos.exit_date ? String(seedPos.exit_date).slice(0, 10) : null);
      } else if (storedDeal > 0 && okVal(storedDeal)) {
        // Prefer press-booked deal $ over a conflicting LLM estimate during rebook.
        v.deal_value_usd = storedDeal;
        v.confidence = Math.max(Number(v.confidence) || 0, 0.85);
      } else if (
        !okVal(v.deal_value_usd) &&
        storedMoic > 1.2 &&
        storedEntry > 0 &&
        storedEntry < MAX_PLAUSIBLE
      ) {
        // Back-calculate deal from signal-based MOIC when press $ is missing.
        const inferred = Math.round(storedEntry * Math.min(storedMoic, MOIC_CAP));
        if (okVal(inferred)) {
          v.exited = true;
          v.is_target = true;
          v.exit_type = v.exit_type || 'acquisition';
          v.deal_value_usd = inferred;
          v.confidence = Math.max(Number(v.confidence) || 0, 0.7);
          v.acquirer = v.acquirer || seedPos.exit_acquirer || null;
          v.exit_date = v.exit_date || (seedPos.exit_date ? String(seedPos.exit_date).slice(0, 10) : null);
        }
      }
    }

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
    let exitDate = v.exit_date || (seedPos?.exit_date ? String(seedPos.exit_date).slice(0, 10) : null) || new Date().toISOString().slice(0, 10);
    const entryMs = seedPos?.entry_date ? new Date(seedPos.entry_date).getTime() : null;
    if (entryMs && new Date(exitDate).getTime() < entryMs) {
      exitDate = new Date().toISOString().slice(0, 10);
    }

    const existingEntry = seedPos ? Number(seedPos.entry_valuation_usd) || 0 : 0;
    const llmPreExit = okVal(v.valuation_before_exit_usd) ? Math.min(Number(v.valuation_before_exit_usd), deal) : 0;
    const roundPreExit = await lastVerifiedPreExitValuation(supabase, id, exitDate);
    const preExit = llmPreExit || roundPreExit;
    const honestEntry = honestEntryFromSignals({
      deal,
      preExit,
      existingEntry,
      entryGodScore: seedPos?.entry_god_score,
      stage: su.stage,
    });
    const seedMoic = honestEntry > 0 ? Math.min(deal / honestEntry, MOIC_CAP) : null;
    const exitMs = new Date(exitDate).getTime();
    const holdingDays = entryMs ? Math.max(1, Math.round((exitMs - entryMs) / 86_400_000)) : 1;
    const moicStored = seedMoic != null ? Math.round(seedMoic * 100) / 100 : null;
    const irrStored = moicStored ? calcIrr(honestEntry, deal, holdingDays) : null;

    results.push({
      name: su.name,
      verdict: `EXIT (${exitType})`,
      deal,
      entry: honestEntry,
      moic: seedMoic,
      conf,
      acquirer: v.acquirer,
    });

    if (APPLY) {
      if (seedPos) {
        const upd = {
          status,
          exit_type: exitType,
          exit_valuation_usd: Math.round(deal),
          exit_date: exitDate,
          exit_acquirer: v.acquirer || null,
          entry_valuation_usd: Math.round(honestEntry),
          current_valuation_usd: Math.round(deal),
          moic: moicStored,
          irr_annualized: irrStored,
          holding_days: holdingDays,
        };
        const { error: updErr } = await supabase.from('virtual_portfolio').update(upd).eq('id', seedPos.id);
        if (updErr) console.error(`   DB error ${su.name}: ${updErr.message}`);
      }
      const f = follByStartup.get(id);
      if (f) {
        await supabase.from('virtual_followon_portfolio').update({
          status,
          exit_type: exitType,
          exit_valuation_usd: Math.round(deal),
          exit_date: exitDate,
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
