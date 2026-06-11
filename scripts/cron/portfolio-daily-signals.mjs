#!/usr/bin/env node
/**
 * DAILY PORTFOLIO SIGNAL TRACKER
 * ==============================
 * Tracks the locked-vintage portfolio every day for material company signals:
 *   • funding      — new closed funding round (real valuation only)
 *   • acquisition  — merger / acquisition / IPO / exit
 *   • partnership  — strategic partnership, integration, alliance
 *   • customer     — notable new customer / contract / revenue milestone
 *   • hire         — key executive / leadership hire
 *   • product      — new product, major launch, patent / IP, innovation
 *
 * For each active position we pull fresh press, classify signals with an LLM
 * (strictly company-matched, closed/real events only — no rumors), dedupe against
 * recent portfolio_events, and persist. Funding signals are plausibility-guarded:
 * a valuation is stored ONLY when explicitly reported and <= $15B; never synthesized.
 *
 * Usage:
 *   node scripts/cron/portfolio-daily-signals.mjs                # dry-run digest
 *   node scripts/cron/portfolio-daily-signals.mjs --apply        # persist events
 *   node scripts/cron/portfolio-daily-signals.mjs --limit 10     # sample
 *   node scripts/cron/portfolio-daily-signals.mjs --name Baseten # single company
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { parseGoogleNewsRss } from '../../server/lib/portfolioFundingVerify.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const limArg = process.argv.indexOf('--limit');
const LIMIT = limArg > -1 ? parseInt(process.argv[limArg + 1], 10) : Infinity;
const nameArg = process.argv.indexOf('--name');
const ONLY_NAME = nameArg > -1 ? process.argv[nameArg + 1] : null;

const MAX_PLAUSIBLE = 15_000_000_000;
const DEDUPE_DAYS = 45;
const CONCURRENCY = 4;

// category → portfolio_events.event_type
const EVENT_TYPE = {
  funding: 'funding_round',
  acquisition: 'acquisition',
  partnership: 'partnership',
  customer: 'customer_win',
  hire: 'key_hire',
  product: 'product_launch',
};
const ICON = { funding: '💰', acquisition: '🤝', partnership: '🔗', customer: '🛒', hire: '👤', product: '🚀' };

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
  const q = encodeURIComponent(`"${company}" funding OR acquisition OR partnership OR customer OR hires OR launches OR raises`);
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en&when=14d`);
  if (!xml.includes('<item>')) return [];
  return parseGoogleNewsRss(xml).slice(0, 10);
}

async function classify(company, items, website) {
  if (!items.length) return [];
  const corpus = items.map((i, n) => `${n + 1}. ${i.title}${i.desc ? ' — ' + i.desc.replace(/<[^>]+>/g, '').slice(0, 220) : ''}`).join('\n');
  const site = website ? ` (official site: ${website})` : '';
  const prompt = `You track material business signals for the company "${company}"${site}.
From the recent headlines, extract ONLY real, already-happened events that are specifically about THIS exact company${site ? ' (verify it matches the official site/domain)' : ''}.
CRITICAL: reject any headline about a different company that merely shares the name, a venture firm with the same word (e.g. "${company} Capital"/"${company} Ventures"), a market trend, or a competitor. When in doubt, exclude it.

Categories (choose the single best per signal):
- funding: a CLOSED funding round (ignore "in talks"/rumored/"eyes")
- acquisition: the company was acquired, merged, went public (IPO), or acquired another company
- partnership: a strategic partnership, alliance, or major integration
- customer: a notable new customer, contract, or revenue milestone
- hire: a key executive / leadership hire
- product: a new product, major launch, patent, or notable innovation/IP

For funding only: amount_usd and post_money_usd as numbers if explicitly reported (else null). NEVER guess a valuation.
summary: one concise factual sentence. confidence: 0-1.

Headlines:
${corpus}

Return ONLY JSON: {"signals":[{"category":string,"summary":string,"headline":string,"source":string|null,"amount_usd":number|null,"post_money_usd":number|null,"round_type":string|null,"confidence":number}]}`;
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    const j = JSON.parse(r.choices[0].message.content);
    return Array.isArray(j.signals) ? j.signals : [];
  } catch (e) {
    console.error(`   LLM error ${company}: ${e.message}`);
    return [];
  }
}

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
}
function similar(a, b) {
  const A = new Set(norm(a)), B = norm(b);
  if (!A.size || !B.length) return 0;
  const hit = B.filter((w) => A.has(w)).length;
  return hit / Math.max(A.size, B.length);
}

async function main() {
  const client = sb();
  console.log(`\n📡 Daily portfolio signal scan ${APPLY ? '(APPLY)' : '(dry-run)'} — ${new Date().toISOString().slice(0, 10)}\n`);

  // Locked cohort: active positions only.
  const { data: picks } = await client
    .from('virtual_portfolio')
    .select('id, startup_id, status')
    .eq('status', 'active');
  const ids = [...new Set((picks || []).map((p) => p.startup_id).filter(Boolean))];
  const nameById = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await client.from('startup_uploads').select('id, name, website').in('id', ids.slice(i, i + 200));
    (data || []).forEach((r) => nameById.set(r.id, r));
  }

  let companies = (picks || [])
    .map((p) => ({ pick: p, su: nameById.get(p.startup_id) }))
    .filter((c) => c.su && c.su.name);
  if (ONLY_NAME) companies = companies.filter((c) => c.su.name.toLowerCase().includes(ONLY_NAME.toLowerCase()));
  companies = companies.slice(0, LIMIT);

  console.log(`Scanning ${companies.length} active positions…\n`);
  const sinceISO = new Date(Date.now() - DEDUPE_DAYS * 86400000).toISOString();
  const digest = { funding: [], acquisition: [], partnership: [], customer: [], hire: [], product: [] };
  let inserted = 0, skipped = 0;

  async function processOne({ pick, su }) {
    const items = await headlines(su.name);
    const signals = await classify(su.name, items, su.website);
    if (!signals.length) return;

    // recent existing events for dedupe
    const { data: recent } = await client
      .from('portfolio_events')
      .select('event_type, headline')
      .eq('startup_id', pick.startup_id)
      .gte('event_date', sinceISO);

    for (const sig of signals) {
      const cat = (sig.category || '').toLowerCase();
      const et = EVENT_TYPE[cat];
      if (!et || (sig.confidence ?? 0) < 0.6) { skipped++; continue; }

      const dup = (recent || []).some((r) => r.event_type === et && similar(r.headline, sig.headline) >= 0.6);
      if (dup) { skipped++; continue; }

      let post = Number(sig.post_money_usd);
      if (!(post > 0 && post <= MAX_PLAUSIBLE)) post = null; // plausibility guard, never synthesized
      const amt = Number(sig.amount_usd) > 0 ? Number(sig.amount_usd) : null;

      const row = {
        startup_id: pick.startup_id,
        portfolio_id: pick.id,
        event_type: et,
        event_date: new Date().toISOString(),
        headline: (sig.headline || sig.summary || '').slice(0, 240),
        source_name: sig.source || null,
        amount_usd: cat === 'funding' ? amt : null,
        post_money_usd: cat === 'funding' ? post : null,
        round_type: cat === 'funding' ? (sig.round_type || null) : null,
        verified: true,
      };

      digest[cat].push(`${su.name}: ${sig.summary}`);
      if (APPLY) {
        const { error } = await client.from('portfolio_events').insert(row);
        if (error) { console.error(`   insert error ${su.name}/${et}: ${error.message}`); continue; }
      }
      inserted++;
      recent?.push({ event_type: et, headline: row.headline });
    }
  }

  for (let i = 0; i < companies.length; i += CONCURRENCY) {
    await Promise.allSettled(companies.slice(i, i + CONCURRENCY).map(processOne));
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('═'.repeat(70));
  console.log(`DAILY PORTFOLIO DIGEST — ${inserted} new signal(s) ${APPLY ? 'recorded' : '(dry-run, not written)'}, ${skipped} skipped\n`);
  for (const cat of Object.keys(digest)) {
    const list = digest[cat];
    if (!list.length) continue;
    console.log(`${ICON[cat]} ${cat.toUpperCase()} (${list.length})`);
    list.slice(0, 12).forEach((l) => console.log(`   • ${l}`));
    if (list.length > 12) console.log(`   …and ${list.length - 12} more`);
    console.log('');
  }
  if (!inserted) console.log('No new material signals today.');
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
