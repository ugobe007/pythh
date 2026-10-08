#!/usr/bin/env node
/**
 * Simple RSS Feed Scraper
 * 
 * Scrapes RSS feeds WITHOUT AI - just extracts headlines and links.
 * Then we can enrich later with AI when credits are available.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
// Shared URL validation — prevents article URLs being stored as startup websites
const { sanitiseWebsiteUrl } = require('../../lib/junk-url-config');
// Canonical shared validator (single source of truth for name quality)
const { isValidStartupName } = require('../../lib/startupNameValidator');
const { insertDiscovered, setSupabase } = require('../../lib/startupInsertGate');
// Shared headline extractor — verb-centric, uses canonical validator
const { extractCompanyName } = require('../../lib/headlineExtractor');
// Sentence-mode multi-name extractor (handles full sentences, multi-name patterns)
const { extractNames: extractNamesFromSentence } = require('../../lib/sentenceExtractor');
// Site-aware parse: source class, sectors, and rumor / market-move guards
const { awareParse } = require('../../lib/scrapeAwareness');
const { shouldProcessEvent } = require('../../lib/source-quality-filter');
const { isArticleFresh } = require('../../lib/rssArticleFreshness');

// Inference extractor for funding / team fields. Sectors come from scrapeAwareness.
let extractInferenceData;
try {
  extractInferenceData = require('../../lib/inference-extractor').extractInferenceData;
  console.log('✅ Inference extractor v2 loaded');
} catch (e) {
  console.log('⚠️  Inference extractor not available');
  extractInferenceData = null;
}

// ENV VALIDATION (fail fast)
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  }
});

// Rate limiting configuration
// TIMEOUT CONTEXT: The Fly.io runner kills the scraper after 30 minutes.
// With 200 sources × 1s delay + HN(30s)/Crunchbase(10s)/TechCrunch(5s) sources, the
// run reliably hits the 30-min wall. Limits reduced to 60 sources per run to stay
// well under 20 minutes. The oldest-first ordering means every source cycles through
// across the 6 runs/day (6 × 60 = 360 source-slots for ~84+ active sources).
const RATE_LIMIT_CONFIG = {
  DEFAULT_DELAY: 800,   // 0.8s between sources
  RATE_LIMITED_SOURCES: {
    'hacker news': 10000,      // 10s for HN (was 30s — too slow)
    'hackernews': 10000,
    'hn': 10000,
    'show hn': 10000,
    'crunchbase': 5000,        // 5s for Crunchbase
    'techcrunch': 2000,        // 2s for TechCrunch
  },
  BACKOFF: {
    initial: 3000,
    max: 60000,                // 1 minute max backoff
    multiplier: 1.5,
  },
  // Hard budget: stop after this many sources per run to avoid the 30-min kill
  MAX_SOURCES_PER_RUN: 60,
};

// Track backoff state per source
const sourceBackoffState = {};

// Helper to get delay for a source
function getSourceDelay(sourceName) {
  const lower = sourceName.toLowerCase();
  for (const [key, delay] of Object.entries(RATE_LIMIT_CONFIG.RATE_LIMITED_SOURCES)) {
    if (lower.includes(key)) return delay;
  }
  return RATE_LIMIT_CONFIG.DEFAULT_DELAY;
}

// Helper to check if source should be skipped due to backoff
function shouldSkipSource(sourceName) {
  const state = sourceBackoffState[sourceName.toLowerCase()];
  if (!state) return false;
  
  const timeSinceError = Date.now() - state.lastError;
  if (timeSinceError < state.backoff) {
    return { skip: true, waitTime: Math.ceil((state.backoff - timeSinceError) / 1000) };
  }
  return false;
}

// Helper to record error for a source
function recordSourceError(sourceName, isRateLimit = false) {
  const lower = sourceName.toLowerCase();
  const state = sourceBackoffState[lower] || { backoff: RATE_LIMIT_CONFIG.BACKOFF.initial, errorCount: 0 };
  
  const newBackoff = isRateLimit 
    ? Math.min(state.backoff * RATE_LIMIT_CONFIG.BACKOFF.multiplier, RATE_LIMIT_CONFIG.BACKOFF.max)
    : state.backoff;
    
  sourceBackoffState[lower] = {
    backoff: newBackoff,
    lastError: Date.now(),
    errorCount: state.errorCount + 1
  };
  
  return newBackoff;
}

// Helper to reset backoff on success
function resetSourceBackoff(sourceName) {
  delete sourceBackoffState[sourceName.toLowerCase()];
}

// Keywords that indicate startup/funding news
const STARTUP_KEYWORDS = [
  'startup', 'funding', 'raised', 'series', 'seed', 'venture', 'launches',
  'founded', 'valuation', 'investment', 'investor', 'accelerator', 'incubator',
  'ai startup', 'fintech', 'healthtech', 'saas', 'million', 'billion'
];

// Check if title is about startup/funding (more lenient)
function isStartupNews(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // More lenient: if it has any startup keyword OR if it's from a startup-focused source
  const hasKeyword = STARTUP_KEYWORDS.some(kw => text.includes(kw));
  
  // Also accept if it mentions company names (capitalized words that look like company names)
  const hasCompanyName = /[A-Z][a-z]+ (raises|launches|secures|closes|announces|hires|partners)/i.test(text);
  
  // Accept funding-related numbers
  const hasFundingAmount = /\$[\d.]+[MB]|million|billion|funding|raised|investment/i.test(text);
  
  return hasKeyword || hasCompanyName || hasFundingAmount;
}

async function scrapeRssFeeds() {
  console.log('📡 Simple RSS Feed Scraper (with Smart Rate Limiting)\n');
  
  // Get active RSS sources (increased limit to handle hundreds of sources)
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('id, name, url, category')
    .eq('active', true)
    .order('last_scraped', { ascending: true, nullsFirst: true }) // Scrape oldest first (fair rotation)
    .limit(RATE_LIMIT_CONFIG.MAX_SOURCES_PER_RUN);
  
  console.log(`Found ${sources?.length || 0} active RSS sources (max ${RATE_LIMIT_CONFIG.MAX_SOURCES_PER_RUN}/run)\n`);
  
  let totalDiscovered = 0;
  let totalAdded = 0;
  let sourcesSkipped = 0;
  let staleSkipped = 0;
  
  for (const source of sources || []) {
    // Check if source should be skipped due to backoff
    const skipCheck = shouldSkipSource(source.name);
    if (skipCheck && skipCheck.skip) {
      console.log(`⏳ Skipping ${source.name} (in backoff: ${skipCheck.waitTime}s remaining)`);
      sourcesSkipped++;
      continue;
    }
    
    // Apply rate limiting delay
    const delay = getSourceDelay(source.name);
    if (delay > RATE_LIMIT_CONFIG.DEFAULT_DELAY) {
      console.log(`⏱️ Rate-limited source: ${source.name} - waiting ${delay / 1000}s`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`\n📰 ${source.name}`);
    console.log(`   ${source.url}`);
    
    try {
      // Add timeout protection for individual feeds (30 seconds max per feed)
      const feedPromise = parser.parseURL(source.url);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Feed timeout after 30s')), 30000)
      );
      
      const feed = await Promise.race([feedPromise, timeoutPromise]);
      
      // Success - reset backoff for this source
      resetSourceBackoff(source.name);
      
      // Increased to 75 items per feed for higher throughput
      const items = feed.items?.slice(0, 75) || [];
      
      console.log(`   Found ${items.length} items`);
      
      let added = 0;
      let skipped = 0;
      for (const item of items) {
        totalDiscovered++;

        if (!item.title || !item.link) {
          skipped++;
          continue;
        }

        if (!isArticleFresh(item.pubDate || item.isoDate).fresh) {
          skipped++;
          staleSkipped++;
          continue;
        }

        if (!shouldProcessEvent(item.title, source.name).keep) {
          skipped++;
          continue;
        }
        
        // Skip if not startup-related
        if (!isStartupNews(item.title || '', item.contentSnippet || item.content || '')) {
          skipped++;
          continue;
        }
        
        // ── Name extraction ───────────────────────────────────────────────────
        // 1. Try headline-mode extractor on the title
        const titleName = extractCompanyName(item.title || '');

        // 2. Try sentence-mode extractor on title + snippet for additional names
        const articleText = `${item.title || ''} ${item.contentSnippet || ''}`.trim();
        const sentenceNames = extractNamesFromSentence(articleText);

        // Merge: headline name first, then sentence names, deduplicated
        const allNames = [...new Set([
          ...(titleName ? [titleName] : []),
          ...sentenceNames,
        ])].filter(n => n && n.length >= 2);

        if (allNames.length === 0) {
          skipped++;
          continue;
        }

        // ── Site-aware sectors + signal (source class, rumor, market move) ──
        let awareness = null;
        try {
          awareness = awareParse({
            title: item.title || '',
            snippet: item.contentSnippet || '',
            feedUrl: source.url,
            feedName: source.name,
            itemUrl: item.link,
          });
        } catch (e) { /* silent */ }
        if (awareness?.guards?.includes('market_move')) {
          skipped++;
          continue;
        }
        const sectors = awareness?.sector_matched ? awareness.sectors : ['Technology'];
        let inferenceData = {};
        if (extractInferenceData) {
          try { inferenceData = extractInferenceData(articleText, item.link); } catch (e) { /* silent */ }
        }
        const pythh_signal = awareness?.signal || null;
        const signalIsLaunched = Boolean(awareness?.product_live);
        const signalIsFundraised = Boolean(awareness?.actionable_fundraising);
        const signalTags = signalIsFundraised
          ? (pythh_signal?.signal_classes || [])
          : (pythh_signal?.signal_classes || []).filter((c) => c !== 'fundraising_signal');

        // ── Insert each name as a separate discovered entry ───────────────────
        setSupabase(supabase);
        let itemAdded = 0;
        for (const companyName of allNames) {
          // Reject obvious article-title fragments
          const isArticleFragment = /\b(based\s+startup|chipmaker|infrastructure\s+provider|funding\s+round|joins?\s+ai|ipo\s+plans?|agrees?\b)/i.test(companyName)
            || /\s{2,}/.test(companyName);
          if (isArticleFragment) continue;

          const nameCheck = isValidStartupName(companyName);
          if (!nameCheck.isValid) continue; // canonical lib/startupNameValidator.js

          try {
            const r = await insertDiscovered({
              name: companyName,
              description: (item.contentSnippet || item.title || '').slice(0, 500),
              website: sanitiseWebsiteUrl(item.link),
              rss_source: source.name,
              article_url: item.link,
              article_title: item.title || '',
              article_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
              sectors,
              discovered_at: new Date().toISOString(),
              funding_amount: signalIsFundraised ? (inferenceData.funding_amount || null) : null,
              funding_stage: signalIsFundraised ? (inferenceData.funding_stage || null) : null,
              value_proposition: inferenceData.value_proposition || null,
              team_signals: inferenceData.team_signals || null,
              execution_signals: [
                ...(inferenceData.execution_signals || []),
                ...signalTags,
              ].filter(Boolean).slice(0, 10) || null,
              is_launched:  signalIsLaunched  || inferenceData.is_launched  || false,
              has_revenue:  signalIsFundraised || inferenceData.has_revenue  || false,
              metadata: {
                ...(Object.keys(inferenceData).length > 0 ? { inference: inferenceData } : {}),
                ...(awareness?.block ? { signals: awareness.block } : {}),
              } || null,
            });

            if (r.ok && !r.skipped) {
              const tag = allNames.length > 1 ? ` [+${allNames.length - 1} more]` : '';
              console.log(`   ✅ ${companyName}${tag} (${sectors.join(', ')})`);
              itemAdded++;
              added++;
              totalAdded++;
            }
          } catch (dbError) {
            console.log(`   ⚠️  ${companyName}: ${dbError.message}`);
          }
        }
        if (itemAdded === 0) skipped++;
      }
      
      if (skipped > 0 && added === 0) {
        console.log(`   ℹ️  ${skipped} items skipped (no company name found or duplicates)`);
      }
      
      // Update last_scraped (with timeout protection)
      try {
        await Promise.race([
          supabase.from('rss_sources')
            .update({ last_scraped: new Date().toISOString() })
            .eq('id', source.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 5000))
        ]);
      } catch (updateError) {
        // Silently fail - don't hang on DB updates
      }
      
      if (added > 0) {
        console.log(`   Added: ${added}`);
      }
      
    } catch (err) {
      // Check error type
      const isRateLimit = err.message.includes('429') || 
                          err.message.includes('Too Many') ||
                          err.message.includes('rate limit');
      const isTimeout = err.message.includes('timeout') || 
                        err.message.includes('ETIMEDOUT') || 
                        err.message.includes('Feed timeout');
      const isConnectionError = err.message.includes('ECONNRESET') ||
                                err.message.includes('ENOTFOUND');
      
      // Record error and get new backoff time
      const newBackoff = recordSourceError(source.name, isRateLimit);
      
      if (isRateLimit) {
        console.log(`   🚫 Rate limited (429) - backing off for ${newBackoff / 1000}s`);
      } else if (isTimeout) {
        console.log(`   ⏱️  Timeout: Feed took too long, backing off for ${newBackoff / 1000}s`);
      } else if (isConnectionError) {
        console.log(`   🔌 Connection error - backing off for ${newBackoff / 1000}s`);
      } else {
        console.log(`   ❌ Error: ${err.message}`);
      }
      
      // Update last_scraped even on error (with timeout protection)
      try {
        await Promise.race([
          supabase.from('rss_sources')
            .update({ last_scraped: new Date().toISOString() })
            .eq('id', source.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 5000))
        ]);
      } catch (updateError) {
        // Silently fail - continue to next feed
      }
      
      // Continue to next feed - don't let one broken feed stop everything
      continue;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total discovered: ${totalDiscovered}`);
  console.log(`Total added: ${totalAdded}`);
  console.log(`Stale items skipped: ${staleSkipped}`);
  console.log(`Sources skipped (backoff): ${sourcesSkipped}`);
  console.log('='.repeat(50));
}

// Run
scrapeRssFeeds().catch(console.error);
