/**
 * portfolio-monitor.mjs
 * =====================================================================
 * Pythh Portfolio Monitoring Agent
 *
 * For each company in the active virtual portfolio:
 *  1. Searches Hacker News (Algolia API) for recent articles (last 14 days)
 *  2. Uses GPT-4o-mini to classify signals:
 *       funding_round | acquisition | ipo | product_launch |
 *       revenue_milestone | team_milestone | prediction_hit
 *  3. Logs new events to portfolio_events (deduped by URL)
 *  4. Updates current_valuation + MOIC if a funding round is confirmed
 *  5. Writes a summary to ai_logs
 *
 * Schedule: daily 6am via PM2 cron
 * Run manually: npx tsx scripts/portfolio-monitor.mjs
 * Dry run:      npx tsx scripts/portfolio-monitor.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose') || DRY_RUN;
const MAX_ARTICLES_PER_COMPANY = 8;
const LOOKBACK_DAYS = 14;
const FETCH_TIMEOUT_MS = 10000;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - LOOKBACK_DAYS);
  return d;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Fetch articles from Hacker News via Algolia (reliable from cloud IPs, no key required)
async function fetchNewsForCompany(name) {
  const cutoff = cutoffDate();
  const since  = Math.floor(cutoff.getTime() / 1000);
  const q = encodeURIComponent(name);
  const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=${MAX_ARTICLES_PER_COMPANY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HN API ${resp.status}`);
    const data = await resp.json();
    return (data.hits || []).map(h => ({
      title:   h.title || h.story_title || '',
      snippet: h.story_text || '',
      url:     h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      pubDate: h.created_at,
      source:  'Hacker News',
    }));
  } finally {
    clearTimeout(timer);
  }
}

// Crude valuation extractor from text: "raises $45M Series A" → 45_000_000
function extractAmount(text) {
  const m = text.match(/\$\s*([\d,.]+)\s*(billion|million|B|M|K)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('b')) return Math.round(num * 1e9);
  if (unit.startsWith('m')) return Math.round(num * 1e6);
  if (unit.startsWith('k')) return Math.round(num * 1e3);
  return Math.round(num);
}

// ─── GPT SIGNAL CLASSIFIER ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a startup intelligence analyst. Given a news article title and snippet about a startup, extract a structured signal.

Return ONLY valid JSON with these fields (no markdown, no explanation):
{
  "event_type": one of ["funding_round","acquisition","ipo","product_launch","revenue_milestone","team_milestone","prediction_hit","noise"],
  "confidence": 0-100,
  "round_type": "Pre-Seed"|"Seed"|"Series A"|"Series B"|"Series C"|"Growth"|null,
  "amount_usd": number (raw dollars) or null,
  "post_money_usd": number or null,
  "lead_investor": "investor name" or null,
  "headline": "clean 1-sentence summary" (max 120 chars),
  "acquirer": "acquiring company name" or null
}

Rules:
- event_type "noise" = general coverage, opinion pieces, no concrete signal
- funding_round only if actual capital raised (not valuation rumour)
- team_milestone = executive hire/departure, key team change
- prediction_hit = startup achieved something Pythh's GOD score predicted
- confidence < 50 → set event_type to "noise"`;

async function classifyArticle(title, snippet, companyName) {
  try {
    const prompt = `Company: ${companyName}\nTitle: ${title}\nSnippet: ${snippet || '(no snippet)'}`;
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.1,
    });
    const raw = resp.choices[0].message.content.trim();
    return JSON.parse(raw);
  } catch {
    return { event_type: 'noise', confidence: 0 };
  }
}

// ─── MOIC / IRR HELPERS ──────────────────────────────────────────────────────

function calcMoic(entry, current) {
  if (!entry || !current || entry <= 0) return null;
  return Math.round((current / entry) * 100) / 100;
}

function calcIrr(entry, current, days) {
  if (!entry || !current || days < 1) return null;
  const years = days / 365;
  return Math.round((Math.pow(current / entry, 1 / years) - 1) * 10000) / 10000;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date();
  console.log(`\n🔭 Pythh Portfolio Monitor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} — ${startedAt.toISOString()}\n`);

  // Load active portfolio
  const { data: portfolio, error: pfErr } = await supabase
    .from('portfolio_summary')
    .select('startup_id, startup_name, entry_valuation_usd, entry_date, current_valuation_usd, status, id')
    .eq('status', 'active')
    .order('entry_god_score', { ascending: false });

  if (pfErr) throw new Error(`Failed to load portfolio: ${pfErr.message}`);
  console.log(`📋 Monitoring ${portfolio.length} active portfolio companies\n`);

  // Load already-logged event URLs to avoid duplicates
  const { data: existingEvents } = await supabase
    .from('portfolio_events')
    .select('source_url')
    .not('source_url', 'is', null);
  const seenUrls = new Set((existingEvents || []).map(e => e.source_url));

  const stats = { companies: 0, articles_scanned: 0, events_found: 0, events_inserted: 0, errors: 0 };
  const summary_lines = [];

  for (const company of portfolio) {
    stats.companies++;
    const name = company.startup_name;

    try {
      // Fetch news via Hacker News Algolia (works from cloud IPs)
      let articles;
      try {
        articles = await withTimeout(fetchNewsForCompany(name), FETCH_TIMEOUT_MS + 2000, name);
      } catch (feedErr) {
        if (VERBOSE) console.log(`  ⚠️  News fetch failed for ${name}: ${feedErr.message}`);
        stats.errors++;
        await sleep(300);
        continue;
      }

      stats.articles_scanned += articles.length;
      if (VERBOSE) console.log(`📰 ${name}: ${articles.length} recent articles`);

      const companyEvents = [];

      for (const item of articles) {
        const url    = item.url || '';
        const title  = item.title || '';
        const snippet = item.snippet || '';

        // Skip already-seen URLs
        if (url && seenUrls.has(url)) continue;

        // GPT classification (10s hard timeout)
        const signal = await withTimeout(
          classifyArticle(title, snippet, name),
          10000,
          `GPT:${name}`
        ).catch(() => ({ event_type: 'noise', confidence: 0 }));
        await sleep(80);

        if (!signal || signal.event_type === 'noise' || signal.confidence < 50) continue;

        stats.events_found++;
        seenUrls.add(url);

        const event = {
          startup_id:     company.startup_id,
          portfolio_id:   company.id,
          event_type:     signal.event_type,
          event_date:     item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          amount_usd:     signal.amount_usd || extractAmount(title) || extractAmount(snippet) || null,
          post_money_usd: signal.post_money_usd || null,
          round_type:     signal.round_type || null,
          lead_investor:  signal.lead_investor || null,
          headline:       signal.headline || title.slice(0, 120),
          source_url:     url || null,
          source_name:    item.source || 'Hacker News',
          verified:       false,
        };

        companyEvents.push(event);

        if (VERBOSE) {
          console.log(`  ✅ [${signal.event_type.toUpperCase()} ${signal.confidence}%] ${signal.headline || title.slice(0, 80)}`);
          if (signal.amount_usd) console.log(`     💰 Amount: $${(signal.amount_usd/1e6).toFixed(1)}M  Lead: ${signal.lead_investor || '?'}`);
        }
      }

      // Insert events
      if (!DRY_RUN && companyEvents.length > 0) {
        const { error: insErr } = await supabase
          .from('portfolio_events')
          .insert(companyEvents);

        if (insErr) {
          console.error(`  ❌ Insert error for ${name}: ${insErr.message}`);
          stats.errors++;
        } else {
          stats.events_inserted += companyEvents.length;

          // Update current_valuation + MOIC if funding round confirmed
          const fundingEvents = companyEvents.filter(
            e => e.event_type === 'funding_round' && (e.post_money_usd || e.amount_usd)
          );

          for (const fe of fundingEvents) {
            const newVal = fe.post_money_usd || fe.amount_usd;
            if (!newVal || newVal <= (company.current_valuation_usd || 0)) continue;

            const entryVal = company.entry_valuation_usd;
            const holdingDays = Math.max(1, Math.round(
              (Date.now() - new Date(company.entry_date).getTime()) / 86400000
            ));
            const moic = calcMoic(entryVal, newVal);
            const irr  = calcIrr(entryVal, newVal, holdingDays);

            await supabase.from('virtual_portfolio').update({
              current_valuation_usd: newVal,
              moic,
              irr_annualized: irr,
              holding_days: holdingDays,
            }).eq('id', company.id);

            console.log(`  📈 ${name} valuation updated: $${(newVal/1e6).toFixed(0)}M | MOIC: ${moic}x`);
          }
        }
      }

      if (companyEvents.length > 0) {
        summary_lines.push(
          `${name}: ${companyEvents.map(e => `[${e.event_type}] ${e.headline?.slice(0,60)}`).join('; ')}`
        );
      }

      // Polite delay between companies
      await sleep(300);

    } catch (err) {
      console.error(`  ❌ Error processing ${name}: ${err.message}`);
      stats.errors++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Monitor complete in ${durationSec}s`);
  console.log(`   Companies scanned:  ${stats.companies}`);
  console.log(`   Articles scanned:   ${stats.articles_scanned}`);
  console.log(`   Signals found:      ${stats.events_found}`);
  console.log(`   Events inserted:    ${DRY_RUN ? '(DRY RUN)' : stats.events_inserted}`);
  console.log(`   Errors:             ${stats.errors}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Log to ai_logs
  if (!DRY_RUN) {
    await supabase.from('ai_logs').insert({
      log_type:   'portfolio_monitor',
      source:     'portfolio-monitor',
      message:    `Portfolio monitor complete: ${stats.events_inserted} events logged across ${stats.companies} companies`,
      metadata:   {
        ...stats,
        duration_sec: durationSec,
        summary: summary_lines.slice(0, 20),
        run_at: startedAt.toISOString(),
      },
    });
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
