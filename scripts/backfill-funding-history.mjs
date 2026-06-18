#!/usr/bin/env node
/**
 * Backfill dated funding rounds into portfolio_events from press + LLM extraction.
 * Timing-first: each round gets event_date, round_type, post_money_usd, verified flag.
 *
 * Usage:
 *   node scripts/backfill-funding-history.mjs
 *   node scripts/backfill-funding-history.mjs --apply
 *   node scripts/backfill-funding-history.mjs --apply --name Treeline
 *   node scripts/backfill-funding-history.mjs --apply --timelines   # also run apply-funding-timelines
 *   node scripts/backfill-funding-history.mjs --apply --fix-post-only --timelines
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import {
  parseGoogleNewsRss,
  extractAmountUsd,
  extractRoundType,
  extractLeadInvestor,
} from '../server/lib/portfolioFundingVerify.js';
import { normalizeRoundType } from '../server/lib/fundingTimelineService.js';
import { estimatePostMoneyFromRound } from '../server/lib/stageValuationBenchmarks.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const RUN_TIMELINES = process.argv.includes('--timelines');
const FIX_POST_ONLY = process.argv.includes('--fix-post-only');
const nameArg = process.argv.indexOf('--name');
const ONLY_NAME = nameArg > -1 ? process.argv[nameArg + 1] : null;
const limArg = process.argv.indexOf('--limit');
const LIMIT = limArg > -1 ? parseInt(process.argv[limArg + 1], 10) : Infinity;
const CONCURRENCY = 3;
const MIN_CONF = 0.65;
const MAX_PLAUSIBLE = 15_000_000_000;

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
  timeout: 90_000,
  maxRetries: 2,
});

function fetchText(url, timeoutMs = 12_000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pythh-PortfolioBot/1.0)' }, timeout: timeoutMs }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; if (b.length > 350_000) { req.destroy(); resolve(b); } });
      res.on('end', () => resolve(b));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

async function headlinesForHistory(company) {
  const queries = [
    `"${company}" raises funding OR seed OR "Series A" OR "Series B" OR mezzanine`,
    `"${company}" valuation OR "post-money" OR "funding round"`,
    `"${company}" acquired OR acquisition OR IPO`,
  ];
  const seen = new Set();
  const items = [];
  for (const q of queries) {
    const xml = await fetchText(
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
    );
    if (!xml.includes('<item>')) continue;
    for (const item of parseGoogleNewsRss(xml)) {
      const key = (item.title || '').slice(0, 100);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return items.slice(0, 18);
}

async function extractFundingHistory(company, website, pickDate, items) {
  const corpus = items.length
    ? items.map((i, n) => `${n + 1}. [${i.pubDate || 'unknown date'}] ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 220) : ''}`).join('\n')
    : '(no headlines)';
  const site = website ? ` (site: ${website})` : '';
  const pick = pickDate ? pickDate.slice(0, 10) : 'unknown';

  const prompt = `You are a venture funding analyst building a TIMELINE for "${company}"${site}.
Oracle picked this company on ${pick}.

From the headlines below, extract every REAL, REPORTED, CLOSED funding round for THIS exact company (match name + domain; reject namesakes).

For each round return:
- round_type: one of pre-seed, seed, series-a, series-b, mezzanine, series-c (normalize Series B+ etc.)
- event_date: ISO date YYYY-MM-DD when the round CLOSED (best estimate from headline; use 1st of month if only month/year known)
- amount_usd: dollars RAISED in the round (not post-money), or null
- post_money_usd: post-money valuation after the round, or null if not reported
- pre_money_usd: pre-money if reported, else null
- lead_investor: lead VC name or null
- headline: best supporting headline text
- source_hint: outlet name if visible
- confidence: 0-1 that this round is real and correctly dated for THIS company

Also extract liquidity_events (acquisition or IPO of THIS company as target) with:
- event_type: acquisition | ipo
- event_date, deal_value_usd, acquirer (if acquisition), headline, confidence

STRICT:
- CLOSED rounds only — ignore "in talks", "reportedly", "eyes", "seeking".
- Do NOT invent rounds or dates. Fewer high-confidence rounds beat guesses.
- Sort rounds by event_date ascending.
- post_money_usd must be plausible (< $15B).

Headlines:
${corpus}

Return ONLY JSON:
{"rounds":[{"round_type":string,"event_date":string,"amount_usd":number|null,"post_money_usd":number|null,"pre_money_usd":number|null,"lead_investor":string|null,"headline":string,"source_hint":string|null,"confidence":number}],"liquidity_events":[{"event_type":string,"event_date":string,"deal_value_usd":number|null,"acquirer":string|null,"headline":string,"confidence":number}]}`;

  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    return JSON.parse(r.choices[0].message.content);
  } catch (e) {
    console.error(`   LLM error ${company}: ${e.message}`);
    return null;
  }
}

const okVal = (n) => Number(n) > 0 && Number(n) <= MAX_PLAUSIBLE;

const TOTAL_RAISED_RE = /(?:bringing|total|raised)\s+(?:funding\s+)?(?:to\s+)?\$\s*(\d[\d,.]*)\s*(million|billion|M|B)/i;

function parseRssDate(pubDate) {
  if (!pubDate) return null;
  const ms = new Date(pubDate).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

function enrichRound(round, items = []) {
  const r = { ...round };
  const text = [r.headline, r.source_hint].filter(Boolean).join(' ');
  if (!okVal(r.amount_usd)) {
    const amt = extractAmountUsd(text);
    if (amt) r.amount_usd = amt;
  }
  if (!r.round_type) r.round_type = extractRoundType(text);
  if (!r.lead_investor) r.lead_investor = extractLeadInvestor(text);
  if (!r.event_date || r.event_date.endsWith('-01-01')) {
    const hit = items.find((i) => i.title && text.includes(i.title.slice(0, 40)));
    const d = parseRssDate(hit?.pubDate);
    if (d) r.event_date = d;
  }
  r.round_type = normalizeRoundType(r.round_type);
  return r;
}

function sanitizeVal(n) {
  const v = Number(n);
  return okVal(v) ? Math.round(v) : null;
}

function roundKey(r) {
  const d = (r.event_date || '').slice(0, 7);
  const rt = normalizeRoundType(r.round_type) || 'unknown';
  const pm = okVal(r.post_money_usd) ? Math.round(Number(r.post_money_usd) / 1e6) : 0;
  return `${d}|${rt}|${pm}`;
}

function matchesExisting(existing, candidate) {
  const cMs = new Date(candidate.event_date).getTime();
  const cPm = Number(candidate.post_money_usd) || Number(candidate.amount_usd) || 0;
  const cRt = normalizeRoundType(candidate.round_type);

  for (const e of existing) {
    if (e.event_type !== 'funding_round') continue;
    const eMs = new Date(e.event_date).getTime();
    const days = Math.abs(cMs - eMs) / 86_400_000;
    const ePm = Number(e.post_money_usd) || Number(e.amount_usd) || 0;
    const eRt = normalizeRoundType(e.round_type);
    const pmClose = cPm && ePm && Math.abs(cPm - ePm) / Math.max(cPm, ePm) < 0.25;
    if (days <= 60 && (pmClose || (cRt && eRt && cRt === eRt))) return e;
  }
  return null;
}

function inferPostMoney(round) {
  const totalMatch = [round.headline, round.source_hint].filter(Boolean).join(' ').match(TOTAL_RAISED_RE);
  let totalRaisedUsd = null;
  if (totalMatch) {
    const num = parseFloat(totalMatch[1].replace(/,/g, ''));
    const mult = totalMatch[2].toLowerCase().startsWith('b') ? 1_000_000_000 : 1_000_000;
    totalRaisedUsd = Math.round(num * mult);
  }
  return estimatePostMoneyFromRound({
    roundType: round.round_type,
    amountUsd: round.amount_usd,
    preMoneyUsd: round.pre_money_usd,
    postMoneyUsd: round.post_money_usd,
    headline: round.headline,
    totalRaisedUsd,
  });
}

function needsPostMoneyFix(e) {
  if (!e.amount_usd && !e.headline) return false;
  if (!e.post_money_usd) return true;
  if (Number(e.post_money_usd) === Number(e.amount_usd)) return true;
  if (Number(e.post_money_usd) > MAX_PLAUSIBLE) return true;
  return false;
}

function estimateEventPostMoney(e) {
  const totalMatch = (e.headline || '').match(TOTAL_RAISED_RE);
  let totalRaisedUsd = null;
  if (totalMatch) {
    const num = parseFloat(totalMatch[1].replace(/,/g, ''));
    const mult = totalMatch[2].toLowerCase().startsWith('b') ? 1_000_000_000 : 1_000_000;
    totalRaisedUsd = Math.round(num * mult);
  }
  const badPost = Number(e.post_money_usd) > MAX_PLAUSIBLE;
  return estimatePostMoneyFromRound({
    roundType: e.round_type,
    amountUsd: e.amount_usd,
    preMoneyUsd: e.pre_money_usd,
    postMoneyUsd: badPost ? null : e.post_money_usd,
    headline: e.headline,
    totalRaisedUsd,
  });
}

async function fixPostMoneyOnly(startupIds, startupNames) {
  console.log(`\n💰 Re-estimate post-money on funding rounds ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);
  const { data: events } = await sb
    .from('portfolio_events')
    .select('id, startup_id, round_type, amount_usd, pre_money_usd, post_money_usd, headline, event_type')
    .in('startup_id', startupIds)
    .eq('event_type', 'funding_round');

  let updated = 0;
  for (const e of events || []) {
    const est = estimateEventPostMoney(e);
    if (!okVal(est)) continue;
    const cur = Number(e.post_money_usd) || 0;
    if (cur > 0 && Math.abs(est - cur) / Math.max(est, cur) < 0.12) continue;
    const name = (startupNames.get(e.startup_id) || '?').slice(0, 18);
    console.log(`  ↻ ${name.padEnd(18)} ${(e.round_type || '?').toString().slice(0, 12).padEnd(12)} $${(est / 1e6).toFixed(0)}M post (was ${cur ? '$' + (cur / 1e6).toFixed(0) + 'M' : '—'})`);
    if (APPLY) await sb.from('portfolio_events').update({ post_money_usd: est }).eq('id', e.id);
    updated++;
  }
  console.log(`\n${updated} round(s) re-estimated.`);
  return updated;
}

async function main() {
  if (FIX_POST_ONLY) {
    const { data: picks } = await sb
      .from('virtual_portfolio')
      .select('startup_id')
      .neq('status', 'written_off');
    const ids = [...new Set((picks || []).map((p) => p.startup_id))];
    const { data: startups } = await sb.from('startup_uploads').select('id, name').in('id', ids);
    const names = new Map((startups || []).map((s) => [s.id, s.name]));
    let targetIds = ids;
    if (ONLY_NAME) {
      const filtered = (startups || []).filter((s) => s.name.toLowerCase().includes(ONLY_NAME.toLowerCase()));
      targetIds = filtered.map((s) => s.id);
    }
    await fixPostMoneyOnly(targetIds, names);
    if (APPLY && RUN_TIMELINES) await runTimelines();
    return;
  }

  console.log(`\n📅 Backfill funding history ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: picks } = await sb
    .from('virtual_portfolio')
    .select('id, startup_id, entry_date, status')
    .neq('status', 'written_off');
  const ids = [...new Set((picks || []).map((p) => p.startup_id))];
  const pickByStartup = new Map((picks || []).map((p) => [p.startup_id, p]));

  const { data: startups } = await sb.from('startup_uploads').select('id, name, website, stage').in('id', ids);
  let rows = (startups || []).filter((s) => s.name);
  if (ONLY_NAME) rows = rows.filter((s) => s.name.toLowerCase().includes(ONLY_NAME.toLowerCase()));
  rows = rows.slice(0, LIMIT);

  const { data: allEvents } = await sb.from('portfolio_events').select('*').in('startup_id', ids);
  const eventsByStartup = new Map();
  for (const e of allEvents || []) {
    if (!eventsByStartup.has(e.startup_id)) eventsByStartup.set(e.startup_id, []);
    eventsByStartup.get(e.startup_id).push(e);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  async function one(su) {
    const pick = pickByStartup.get(su.id);
    const existing = eventsByStartup.get(su.id) || [];
    const items = await headlinesForHistory(su.name);
    const hist = await extractFundingHistory(su.name, su.website, pick?.entry_date, items);
    if (!hist && !existing.some((e) => e.event_type === 'funding_round')) { skipped++; return; }

    const rounds = (hist?.rounds || [])
      .map((r) => enrichRound(r, items))
      .filter((r) => (Number(r.confidence) || 0) >= MIN_CONF && r.event_date);
    const liquidity = (hist?.liquidity_events || []).filter((r) => (Number(r.confidence) || 0) >= MIN_CONF && r.event_date);

    if (!rounds.length && !liquidity.length && !existing.some((e) => e.event_type === 'funding_round')) {
      skipped++;
    }

    const added = [];
    for (const r of rounds) {
      const post = inferPostMoney(r);
      const amount = sanitizeVal(r.amount_usd);
      const pre = sanitizeVal(r.pre_money_usd);
      if (!post && !amount) continue;
      const candidate = {
        event_type: 'funding_round',
        event_date: r.event_date,
        round_type: r.round_type,
        amount_usd: amount,
        post_money_usd: post,
        pre_money_usd: pre,
        lead_investor: r.lead_investor || null,
        headline: r.headline || `${su.name} ${r.round_type || 'funding'} round`,
        source_name: r.source_hint || 'press backfill',
        verified: true,
      };

      const match = matchesExisting(existing, candidate);
      if (match) {
        const patch = {};
        if (!match.round_type && candidate.round_type) patch.round_type = candidate.round_type;
        const badPost = Number(match.post_money_usd) > MAX_PLAUSIBLE;
        if (badPost || (!match.post_money_usd && candidate.post_money_usd)) patch.post_money_usd = candidate.post_money_usd;
        if (!match.amount_usd && candidate.amount_usd) patch.amount_usd = candidate.amount_usd;
        if (!match.verified) patch.verified = true;
        const matchMs = new Date(match.event_date).getTime();
        const candMs = new Date(candidate.event_date).getTime();
        if (Math.abs(matchMs - candMs) > 30 * 86_400_000 && candMs < matchMs) patch.event_date = candidate.event_date;
        if (Object.keys(patch).length) {
          console.log(`  ↻ ${su.name.slice(0, 18).padEnd(18)} update ${candidate.round_type || '?'} ${candidate.event_date.slice(0, 10)} ${post ? '$' + (post / 1e6).toFixed(0) + 'M' : ''}`);
          if (APPLY) await sb.from('portfolio_events').update(patch).eq('id', match.id);
          updated++;
        }
        continue;
      }

      console.log(`  + ${su.name.slice(0, 18).padEnd(18)} ${(candidate.round_type || '?').padEnd(10)} ${candidate.event_date.slice(0, 10)} ${post ? '$' + (post / 1e6).toFixed(0) + 'M post' : ''}`);
      if (APPLY) {
        await sb.from('portfolio_events').insert({
          startup_id: su.id,
          portfolio_id: pick?.id || null,
          ...candidate,
        });
      }
      inserted++;
      existing.push(candidate);
      added.push(candidate);
    }

    for (const liq of liquidity) {
      if (!okVal(liq.deal_value_usd)) continue;
      const dup = existing.some((e) =>
        (e.event_type === 'acquisition' || e.event_type === 'ipo') &&
        Math.abs(new Date(e.event_date).getTime() - new Date(liq.event_date).getTime()) < 90 * 86_400_000,
      );
      if (dup) continue;
      console.log(`  + ${su.name.slice(0, 18).padEnd(18)} ${liq.event_type}     ${liq.event_date.slice(0, 10)} $${(liq.deal_value_usd / 1e9).toFixed(2)}B`);
      if (APPLY) {
        await sb.from('portfolio_events').insert({
          startup_id: su.id,
          portfolio_id: pick?.id || null,
          event_type: liq.event_type,
          event_date: liq.event_date,
          post_money_usd: Math.round(Number(liq.deal_value_usd)),
          amount_usd: Math.round(Number(liq.deal_value_usd)),
          headline: liq.headline || `${su.name} ${liq.event_type}`,
          lead_investor: liq.acquirer || null,
          verified: true,
          source_name: 'press backfill',
        });
      }
      inserted++;
    }

    // Patch existing funding_round rows — amounts, dates, and post-money estimates.
    for (const e of existing.filter((x) => x.event_type === 'funding_round')) {
      const enriched = enrichRound({
        headline: e.headline,
        round_type: e.round_type,
        event_date: e.event_date,
        amount_usd: e.amount_usd,
        post_money_usd: e.post_money_usd,
        confidence: 1,
      }, items);
      const patch = {};
      if (Number(e.post_money_usd) > MAX_PLAUSIBLE) patch.post_money_usd = null;
      if (!e.amount_usd && enriched.amount_usd) patch.amount_usd = enriched.amount_usd;
      if (!e.round_type && enriched.round_type) patch.round_type = enriched.round_type;

      const estPost = estimateEventPostMoney({ ...e, ...patch, amount_usd: patch.amount_usd || e.amount_usd });
      if (needsPostMoneyFix(e) && okVal(estPost)) patch.post_money_usd = estPost;

      if (Object.keys(patch).length) {
        const pm = patch.post_money_usd || e.post_money_usd;
        console.log(`  ↻ ${su.name.slice(0, 18).padEnd(18)} patch stored ${(enriched.round_type || e.round_type || '?').padEnd(10)} ${pm ? '$' + (pm / 1e6).toFixed(0) + 'M post' : patch.amount_usd ? '$' + (patch.amount_usd / 1e6).toFixed(0) + 'M' : ''}`);
        if (APPLY) await sb.from('portfolio_events').update(patch).eq('id', e.id);
        updated++;
      }
    }

    if (added.length) {
      const stages = [...new Set(added.map((a) => a.round_type).filter(Boolean))].join(', ');
      console.log(`     → stages: ${stages}`);
    }
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.allSettled(rows.slice(i, i + CONCURRENCY).map(one));
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n${inserted} round(s) inserted, ${updated} updated, ${skipped} skipped (no confident history).`);
  if (!APPLY) console.log('(dry-run — re-run with --apply to persist.)');

  if (APPLY && RUN_TIMELINES) await runTimelines();
}

async function runTimelines() {
  console.log('\n⏱️  Applying funding timelines…\n');
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/apply-funding-timelines.mjs', '--apply'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('timelines exit ' + code))));
  });
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
