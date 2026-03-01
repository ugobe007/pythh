/**
 * portfolio-monitor.mjs
 * =====================================================================
 * Pythh Portfolio Monitoring Agent
 *
 * Architecture: fetch 4-5 startup-focused RSS feeds ONCE, then match
 * each portfolio company against all articles — far more efficient than
 * querying per-company, and TechCrunch RSS is confirmed accessible from
 * Fly.io cloud IPs.
 *
 * Sources (primary):  TechCrunch /startups, /venture, /apps, main feed
 * Sources (secondary): VentureBeat, HN Algolia per-company fallback
 *
 * Schedule: daily 6am UTC via PM2 cron (ecosystem.prod.config.js)
 * Run manually: npx tsx scripts/portfolio-monitor.mjs
 * Dry run:      npx tsx scripts/portfolio-monitor.mjs --dry-run
 * Verbose:      npx tsx scripts/portfolio-monitor.mjs --dry-run --verbose
 */

import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const DRY_RUN  = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose') || DRY_RUN;
const LOOKBACK_DAYS    = 14;
const FETCH_TIMEOUT_MS = 12000;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const rss    = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  customFields: { item: ['content:encoded', 'description'] },
});

// ─── SIGNAL FEEDS (TechCrunch confirmed 200 OK from Fly.io) ──────────────────
const SIGNAL_FEEDS = [
  { url: 'https://techcrunch.com/category/startups/feed/', name: 'TechCrunch Startups' },
  { url: 'https://techcrunch.com/category/venture/feed/', name: 'TechCrunch Venture' },
  { url: 'https://techcrunch.com/category/apps/feed/',    name: 'TechCrunch Apps' },
  { url: 'https://techcrunch.com/feed/',                  name: 'TechCrunch Main' },
  { url: 'https://venturebeat.com/feed/',                 name: 'VentureBeat' },
];
// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - LOOKBACK_DAYS);
  return d;
}

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms); }),
  ]).finally(() => clearTimeout(t));
}

function extractAmount(text) {
  const m = text.match(/\$\s*([\d,.]+)\s*(billion|million|B|M|K)?/i);
  if (!m) return null;
  const num  = parseFloat(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('b')) return Math.round(num * 1e9);
  if (unit.startsWith('m')) return Math.round(num * 1e6);
  if (unit.startsWith('k')) return Math.round(num * 1e3);
  return Math.round(num);
}

function calcMoic(entry, current) {
  if (!entry || !current || entry <= 0) return null;
  return Math.round((current / entry) * 100) / 100;
}

function calcIrr(entry, current, days) {
  if (!entry || !current || days < 1) return null;
  return Math.round((Math.pow(current / entry, 1 / (days / 365)) - 1) * 10000) / 10000;
}

// ─── FETCH ALL NEWS ARTICLES (one pass across all feeds) ─────────────────────

async function fetchAllArticles() {
  const cutoff   = cutoffDate();
  const articles = [];
  const seenUrls = new Set();

  for (const feed of SIGNAL_FEEDS) {
    try {
      const result = await withTimeout(rss.parseURL(feed.url), FETCH_TIMEOUT_MS, feed.name);
      let count = 0;
      for (const item of (result.items || [])) {
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;
        if (pubDate && pubDate < cutoff) continue;
        const url = item.link || item.guid || '';
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        articles.push({
          title:   item.title || '',
          snippet: item.contentSnippet || item.description || item['content:encoded'] || '',
          url,
          pubDate: pubDate?.toISOString() || new Date().toISOString(),
          source:  feed.name,
        });
        count++;
      }
      if (VERBOSE) console.log(`  📡 ${feed.name}: ${count} recent articles`);
    } catch (err) {
      if (VERBOSE) console.log(`  ⚠️  Feed failed (${feed.name}): ${err.message}`);
    }
    await sleep(200);
  }
  return articles;
}

// ─── HN ALGOLIA FALLBACK (per company, only if zero feed matches) ─────────────

async function fetchHNArticles(name, cutoff) {
  try {
    const since = Math.floor(cutoff.getTime() / 1000);
    const url   = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(name)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=4`;
    const resp  = await withTimeout(fetch(url), FETCH_TIMEOUT_MS, `HN:${name}`);
    if (!resp.ok) return [];
    const data  = await resp.json();
    return (data.hits || []).map(h => ({
      title:   h.title || '',
      snippet: h.story_text || '',
      url:     h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      pubDate: h.created_at,
      source:  'Hacker News',
    }));
  } catch { return []; }
}

// ─── GPT SIGNAL CLASSIFIER ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a startup intelligence analyst. Given a news article about a company, extract a structured signal.

Return ONLY valid JSON (no markdown, no explanation):
{
  "event_type": one of ["funding_round","acquisition","ipo","product_launch","revenue_milestone","team_milestone","prediction_hit","noise"],
  "confidence": 0-100,
  "round_type": "Pre-Seed"|"Seed"|"Series A"|"Series B"|"Series C"|"Growth"|null,
  "amount_usd": number (raw dollars) or null,
  "post_money_usd": number or null,
  "lead_investor": "investor name" or null,
  "headline": "clean 1-sentence summary" (max 120 chars),
  "acquirer": "acquiring company" or null
}

Rules:
- "noise" = no concrete business event for this specific company
- funding_round = actual capital raised (not rumour)
- confidence < 50 → set event_type to "noise"
- Only classify events about the TARGET COMPANY, not competitors or vague mentions`;

async function classifyArticle(title, snippet, companyName) {
  try {
    const resp = await withTimeout(openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Target company: ${companyName}\nTitle: ${title}\nSnippet: ${(snippet||'').slice(0,400)}` },
      ],
      max_tokens: 250,
      temperature: 0.1,
    }), 12000, `GPT:${companyName}`);
    return JSON.parse(resp.choices[0].message.content.trim());
  } catch {
    return { event_type: 'noise', confidence: 0 };
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date();
  const cutoff    = cutoffDate();
  console.log(`\n🔭 Pythh Portfolio Monitor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} — ${startedAt.toISOString()}\n`);

  // Load active portfolio
  const { data: portfolio, error: pfErr } = await supabase
    .from('portfolio_summary')
    .select('startup_id, startup_name, entry_valuation_usd, entry_date, current_valuation_usd, status, id')
    .eq('status', 'active')
    .order('entry_god_score', { ascending: false });
  if (pfErr) throw new Error(`Portfolio load failed: ${pfErr.message}`);

  console.log(`📋 ${portfolio.length} active companies — fetching RSS feeds...\n`);

  // Load already-seen URLs
  const { data: existingEvents } = await supabase
    .from('portfolio_events').select('source_url').not('source_url', 'is', null);
  const seenUrls = new Set((existingEvents || []).map(e => e.source_url));

  // ── ONE-PASS RSS FETCH ───────────────────────────────────────────────────
  const allArticles = await fetchAllArticles();
  console.log(`\n📰 Total articles from RSS feeds: ${allArticles.length}\n`);

  const stats = { companies: 0, articles_scanned: 0, signals_found: 0, events_inserted: 0, errors: 0 };
  const summaryLines = [];

  for (const company of portfolio) {
    stats.companies++;
    const name      = company.startup_name;
    const nameLower = name.toLowerCase();

    // Match articles from feeds by company name in title or snippet
    let matched = allArticles.filter(a =>
      `${a.title} ${a.snippet}`.toLowerCase().includes(nameLower)
    );

    // Fallback: HN Algolia per-company search if no feed hits
    if (matched.length === 0) {
      const hn = await fetchHNArticles(name, cutoff);
      matched = hn;
      await sleep(100);
    }

    const newArticles = matched.filter(a => !seenUrls.has(a.url));
    stats.articles_scanned += newArticles.length;

    if (VERBOSE && newArticles.length > 0) console.log(`\n🏢 ${name}: ${newArticles.length} new articles`);

    const companyEvents = [];

    for (const item of newArticles) {
      const signal = await classifyArticle(item.title, item.snippet, name)
        .catch(() => ({ event_type: 'noise', confidence: 0 }));
      await sleep(80);

      if (!signal || signal.event_type === 'noise' || signal.confidence < 50) continue;

      stats.signals_found++;
      seenUrls.add(item.url);

      companyEvents.push({
        startup_id:     company.startup_id,
        portfolio_id:   company.id,
        event_type:     signal.event_type,
        event_date:     item.pubDate || new Date().toISOString(),
        amount_usd:     signal.amount_usd || extractAmount(item.title) || extractAmount(item.snippet) || null,
        post_money_usd: signal.post_money_usd || null,
        round_type:     signal.round_type || null,
        lead_investor:  signal.lead_investor || null,
        headline:       signal.headline || item.title.slice(0, 120),
        source_url:     item.url || null,
        source_name:    item.source || 'RSS',
        verified:       false,
      });

      if (VERBOSE) {
        console.log(`  ✅ [${signal.event_type.toUpperCase()} ${signal.confidence}%] ${(signal.headline||item.title).slice(0,80)}`);
        if (signal.amount_usd) console.log(`     💰 $${(signal.amount_usd/1e6).toFixed(1)}M  Lead: ${signal.lead_investor||'?'}`);
      }
    }

    if (!DRY_RUN && companyEvents.length > 0) {
      const { error: insErr } = await supabase.from('portfolio_events').insert(companyEvents);
      if (insErr) {
        console.error(`  ❌ Insert error (${name}): ${insErr.message}`);
        stats.errors++;
      } else {
        stats.events_inserted += companyEvents.length;
        // Update valuation + MOIC on funding round confirmation
        for (const fe of companyEvents.filter(e => e.event_type === 'funding_round')) {
          const newVal = fe.post_money_usd || fe.amount_usd;
          if (!newVal || newVal <= (company.current_valuation_usd || 0)) continue;
          const days = Math.max(1, Math.round((Date.now() - new Date(company.entry_date).getTime()) / 86400000));
          await supabase.from('virtual_portfolio').update({
            current_valuation_usd: newVal,
            moic:           calcMoic(company.entry_valuation_usd, newVal),
            irr_annualized: calcIrr(company.entry_valuation_usd, newVal, days),
            holding_days:   days,
          }).eq('id', company.id);
          console.log(`  📈 ${name} valuation → $${(newVal/1e6).toFixed(0)}M`);
        }
      }
    }

    if (companyEvents.length > 0)
      summaryLines.push(`${name}: ${companyEvents.map(e => `[${e.event_type}] ${e.headline?.slice(0,50)}`).join('; ')}`);
  }

  const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Monitor complete in ${durationSec}s`);
  console.log(`   RSS articles fetched:  ${allArticles.length}`);
  console.log(`   New articles checked:  ${stats.articles_scanned}`);
  console.log(`   Signals found:         ${stats.signals_found}`);
  console.log(`   Events inserted:       ${DRY_RUN ? '(dry run)' : stats.events_inserted}`);
  console.log(`   Errors:                ${stats.errors}`);
  console.log(`${'─'.repeat(60)}\n`);

  if (!DRY_RUN) {
    await supabase.from('ai_logs').insert({
      log_type: 'portfolio_monitor',
      source:   'portfolio-monitor',
      message:  `Monitor: ${stats.events_inserted} events logged, ${allArticles.length} RSS articles scanned`,
      metadata: { ...stats, rss_articles: allArticles.length, duration_sec: durationSec, summary: summaryLines.slice(0, 20) },
    });
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });


