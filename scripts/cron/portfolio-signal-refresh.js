#!/usr/bin/env node
/**
 * Portfolio Signal Refresh
 *
 * Runs weekly on all active portfolio companies:
 *   1. Scrapes company website + RSS for new funding/milestone signals
 *   2. Detects funding events → writes to portfolio_events
 *   3. Updates current_valuation_usd + recalculates MOIC when new rounds close
 *   4. Writes startup_signals for god-score re-weight on next recalc
 *   5. Flags picks whose god_delta has moved > ±5 points for review
 *
 * Usage:
 *   node scripts/cron/portfolio-signal-refresh.js              # full run
 *   node scripts/cron/portfolio-signal-refresh.js --dry-run    # no DB writes
 *   node scripts/cron/portfolio-signal-refresh.js --id=<uuid>  # single pick
 */

'use strict';
require('dotenv').config();

const https   = require('https');
const http    = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');
const {
  parseGoogleNewsRss,
  assessFundingSignal,
} = require('../../server/lib/portfolioFundingVerify');

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE  = (process.argv.find(a => a.startsWith('--id=')) || '').replace('--id=', '') || null;
const MISSING_ONLY = process.argv.includes('--missing-only');
const CONCURRENCY = 2;
const FETCH_TIMEOUT_MS = 10_000;
const BATCH_PAUSE_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sb() {
  return createClient(SB_URL, SB_KEY);
}

// ── Funding signal patterns (helpers in portfolioFundingVerify) ───────────────

function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (err, body = '') => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(body);
    };
    const req = lib.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers: { 'User-Agent': 'Pythh-PortfolioBot/1.0' }, timeout: timeoutMs },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => {
          body += d;
          if (body.length > 200_000) {
            req.destroy();
            finish(null, body);
          }
        });
        res.on('end', () => finish(null, body));
      }
    );
    req.on('error', (err) => finish(err));
    req.on('timeout', () => {
      req.destroy();
      finish(new Error('timeout'));
    });
  });
}

async function scrapeWebsite(website) {
  if (!website) return '';
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    return await fetchText(url);
  } catch {
    return '';
  }
}

async function scrapeGoogleNews(companyName) {
  const q = encodeURIComponent(`"${companyName}" funding OR raises OR round OR investment`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await fetchText(url);
    return parseGoogleNewsRss(xml);
  } catch {
    return [];
  }
}

async function detectFundingEvent(company) {
  const { name, website } = company;
  const [homeText, newsItems] = await Promise.all([
    scrapeWebsite(website),
    scrapeGoogleNews(name),
  ]);

  return assessFundingSignal(name, { homeText, newsItems, website });
}

function calcNewValuation(amountUsd, roundType) {
  // Simple heuristic: post-money = amount / dilution rate by stage
  const dilutionByStage = {
    'pre-seed': 0.15, 'seed': 0.18, 'series-a': 0.20,
    'series-b': 0.15, 'series-c': 0.12, 'series-d': 0.10,
  };
  const stage = (roundType || 'seed').toLowerCase();
  const dilution = Object.entries(dilutionByStage).find(([k]) => stage.includes(k))?.[1] || 0.18;
  return amountUsd ? Math.round(amountUsd / dilution) : null;
}

function calcMoic(currentVal, entryVal, virtualCheck) {
  if (!currentVal || !entryVal) return 1;
  // ownership stake = virtualCheck / entryVal (entry valuation is pre-money implied)
  const stake = virtualCheck / entryVal;
  return Math.round((stake * currentVal / virtualCheck) * 100) / 100;
}

async function processPortfolioCompany(pick, portfolioId) {
  const { startup_id, entry_valuation_usd, virtual_check_usd, startup_name, website, current_valuation_usd, entry_god_score } = pick;
  const client = sb();

  console.log(`  → ${startup_name}`);

  // 1. Check for funding events
  const event = await detectFundingEvent({ name: startup_name, website });
  if (event) {
    console.log(`    💰 Funding ${event.verified ? 'verified' : 'signal'}: ${event.round_type || '?'} round, amount=$${event.amount_usd || '?'}`);

    if (!DRY_RUN) {
      // Check if we already logged this event recently (avoid dupes within 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: existing } = await client
        .from('portfolio_events')
        .select('id')
        .eq('startup_id', startup_id)
        .eq('event_type', 'funding_round')
        .gte('event_date', thirtyDaysAgo)
        .limit(1);

      if (!existing?.length) {
        const newPostMoney = event.amount_usd ? calcNewValuation(event.amount_usd, event.round_type) : null;

        await client.from('portfolio_events').insert({
          startup_id,
          portfolio_id: portfolioId,
          event_type:    event.event_type,
          amount_usd:    event.amount_usd,
          post_money_usd: newPostMoney,
          round_type:    event.round_type,
          lead_investor: event.lead_investor,
          headline:      event.headline,
          source_url:    event.source_url ?? null,
          source_name:   event.source_name ?? null,
          verified:      event.verified ?? false,
        });

        // Only mark up MOIC on press-verified raises (signals stay in the funded count)
        if (newPostMoney && event.verified) {
          const newMoic = calcMoic(newPostMoney, entry_valuation_usd, virtual_check_usd);
          await client.from('virtual_portfolio')
            .update({ current_valuation_usd: newPostMoney, moic: newMoic })
            .eq('startup_id', startup_id)
            .eq('status', 'active');
          console.log(`    📈 Verified markup: $${Math.round(newPostMoney/1e6)}M, MOIC: ${newMoic}x`);
        } else if (newPostMoney) {
          console.log('    (signal logged — MOIC unchanged until press-verified)');
        }
      } else {
        console.log('    (funding event already logged in last 30 days, skipping)');
      }
    }
  }

  // 2. Check god_delta — flag significant drift
  const { data: current } = await client
    .from('startup_uploads')
    .select('total_god_score')
    .eq('id', startup_id)
    .single();

  if (current && entry_god_score) {
    const delta = (current.total_god_score || 0) - entry_god_score;
    if (Math.abs(delta) >= 8) {
      const direction = delta > 0 ? '↑' : '↓';
      console.log(`    ${direction} GOD delta: ${delta > 0 ? '+' : ''}${delta} pts — ${delta >= 8 ? 'NOTABLE IMPROVEMENT' : 'NOTABLE DECLINE'}`);

      // Write a god_score_change event
      if (!DRY_RUN) {
        const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const { data: existingDelta } = await client.from('portfolio_events')
          .select('id').eq('startup_id', startup_id)
          .eq('event_type', 'god_score_change').gte('event_date', threeDaysAgo).limit(1);

        if (!existingDelta?.length) {
          await client.from('portfolio_events').insert({
            startup_id,
            portfolio_id: portfolioId,
            event_type:    'god_score_change',
            headline:      `GOD score moved ${delta > 0 ? '+' : ''}${delta} pts (now ${current.total_god_score}, entry ${entry_god_score})`,
            god_score_before: entry_god_score,
            god_score_after:  current.total_god_score,
            verified: true,
          });
        }
      }
    }
  }
}

async function runBatch(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
    if (i + concurrency < items.length) await sleep(BATCH_PAUSE_MS);
  }
}

async function main() {
  console.log('🔄 Portfolio Signal Refresh');
  console.log('═'.repeat(50));
  console.log('Run at:', new Date().toISOString());
  if (DRY_RUN) console.log('⚠️  DRY-RUN mode — no DB writes');
  if (MISSING_ONLY) console.log('📋 Missing-only — picks with no funding_round event');
  console.log('');

  const client = sb();

  // Fetch active portfolio picks (with startup details via view)
  let query = client.from('portfolio_summary')
    .select('*')
    .eq('status', 'active');
  if (SINGLE) query = query.eq('startup_id', SINGLE);

  const { data: picks, error } = await query;
  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!picks?.length) { console.log('No active portfolio picks found.'); process.exit(0); }

  let filteredPicks = picks;
  if (MISSING_ONLY && !SINGLE) {
    const portfolioIds = picks.map((p) => p.id);
    const { data: fundedRows } = await client
      .from('portfolio_events')
      .select('portfolio_id')
      .eq('event_type', 'funding_round')
      .in('portfolio_id', portfolioIds);
    const fundedIds = new Set((fundedRows || []).map((r) => r.portfolio_id));
    filteredPicks = picks.filter((p) => !fundedIds.has(p.id));
  }

  if (!filteredPicks.length) { console.log('No picks to process.'); process.exit(0); }

  console.log(`Processing ${filteredPicks.length} active picks...\n`);

  // Map to a usable shape — portfolio_summary has startup data joined
  const companies = filteredPicks.map(p => ({
    startup_id:            p.startup_id,
    startup_name:          p.startup_name,
    website:               p.website,
    entry_valuation_usd:   p.entry_valuation_usd,
    current_valuation_usd: p.current_valuation_usd,
    virtual_check_usd:     p.virtual_check_usd,
    entry_god_score:       p.entry_god_score,
    portfolioId:           p.id,
  }));

  let processed = 0;
  await runBatch(companies, CONCURRENCY, async (c) => {
    try {
      await processPortfolioCompany(c, c.portfolioId);
      processed++;
    } catch (e) {
      console.error(`  ✗ Error processing ${c.startup_name}:`, e.message);
    }
  });

  console.log(`\n✅ Done — ${processed}/${companies.length} picks processed`);

  // Summary: print updated metrics
  const { data: metrics } = await client.from('portfolio_metrics').select('*').maybeSingle();
  if (metrics) {
    console.log('\n📊 Portfolio Metrics:');
    console.log(`  Total picks: ${metrics.total_picks} | Active: ${metrics.active_picks}`);
    console.log(`  Avg MOIC: ${metrics.avg_moic}x | Best MOIC: ${metrics.best_moic}x`);
    console.log(`  Funded: ${metrics.funded_picks ?? '—'} (${metrics.funded_rate_pct ?? metrics.win_rate_pct}%) | Verified: ${metrics.verified_funded_picks ?? 0} | Exited: ${metrics.successful_exits ?? 0} | Deployed: $${Math.round(metrics.total_virtual_deployed_usd/1e6)}M`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
