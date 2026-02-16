#!/usr/bin/env node
/**
 * SSOT-Compliant RSS Scraper
 * 
 * Architecture (Parser is SSOT):
 * 1. Ingest ALL RSS items
 * 2. Pass to Phase-Change parser (SSOT for decisions)
 * 3. Phase A: ALWAYS store event (even FILTERED/OTHER)
 * 4. Phase B: ONLY create graph joins when parser.graph_safe=true
 * 
 * NO judgment logic allowed in extractor - parser decides everything.
 * 
 * Anti-blocking strategies:
 * - Rotating User-Agents (browser-like)
 * - Adaptive delays based on response codes
 * - ETag/Last-Modified caching
 * - Exponential backoff on failures
 * - Optional proxy support for blocked sources
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Import Phase-Change parser directly (tsx handles TypeScript)
const { parseFrameFromTitle, toCapitalEvent, setOntologyEntities } = require('../../src/services/rss/frameParser.ts');

// Import v2 Inference Extractor + REAL GOD Scoring
const { extractInferenceData, extractSectors: v2ExtractSectors, assessConfidence } = require('../../lib/inference-extractor');
const { calculateHotScore } = require('../../server/services/startupScoringService.ts');

/**
 * Transform a startup row into a scoring profile (matches recalculate-scores.ts SSOT).
 */
function toScoringProfile(startup) {
  const extracted = startup.extracted_data || {};
  return {
    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    market_size: startup.market_size || extracted.market_size,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    team: extracted.team || [],
    founders_count: startup.team_size || extracted.team_size || 1,
    technical_cofounders: (extracted.has_technical_cofounder ? 1 : 0),
    mrr: extracted.mrr,
    revenue: extracted.revenue || extracted.arr,
    growth_rate: extracted.growth_rate || extracted.growth_rate_monthly,
    customers: extracted.customers || extracted.customer_count,
    active_users: extracted.active_users || extracted.users,
    gmv: extracted.gmv,
    retention_rate: extracted.retention_rate,
    churn_rate: extracted.churn_rate,
    has_revenue: extracted.has_revenue,
    has_customers: extracted.has_customers,
    execution_signals: extracted.execution_signals || [],
    team_signals: extracted.team_signals || [],
    funding_amount: extracted.funding_amount,
    funding_stage: extracted.funding_stage,
    launched: extracted.is_launched || extracted.launched,
    demo_available: extracted.has_demo || extracted.demo_available,
    unique_ip: extracted.unique_ip,
    defensibility: extracted.defensibility,
    mvp_stage: extracted.mvp_stage,
    founded_date: extracted.founded_date,
    value_proposition: extracted.value_proposition,
    backed_by: extracted.backed_by || extracted.investors,
    ...startup,
    ...extracted
  };
}

/**
 * Calculate REAL GOD score using the official scoring service.
 */
function calculateGODScore(startup) {
  const profile = toScoringProfile(startup);
  const result = calculateHotScore(profile);
  const total = Math.round(result.total * 10);
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
  return {
    team_score: Math.round((teamCombined / 3.5) * 100),
    traction_score: Math.round(((result.breakdown.traction || 0) / 3.0) * 100),
    market_score: Math.round((marketCombined / 2.0) * 100),
    product_score: Math.round(((result.breakdown.product || 0) / 1.3) * 100),
    vision_score: Math.round(((result.breakdown.product_vision || 0) / 1.3) * 100),
    total_god_score: total
  };
}

// ============================================================================
// ENV VALIDATION (fail fast with clear error)
// ============================================================================
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ FATAL: Missing required env var: ${key}`);
    console.error('   Ensure .env file exists and contains this variable.');
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// GRACEFUL SHUTDOWN (prevents PM2 cron_restart from killing mid-DB-write)
// ============================================================================
let shuttingDown = false;

function handleShutdown(signal) {
  if (shuttingDown) return; // Already shutting down
  shuttingDown = true;
  console.log(`\n⚠️  Received ${signal} — finishing current source, then exiting gracefully...`);
  // The main scrape loop checks `shuttingDown` and breaks after the current source
  // Give 30s to finish current work before force-kill
  setTimeout(() => {
    console.log('⏰ Graceful shutdown timeout — force exiting');
    process.exit(0);
  }, 30000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// ============================================================================
// PROXY CONFIGURATION (Optional - set in .env)
// ============================================================================
// Set PROXY_URL in .env to enable: PROXY_URL=http://user:pass@proxy.example.com:8080
const PROXY_URL = process.env.PROXY_URL || null;
const PROXY_ENABLED = !!PROXY_URL;

// Sources that require proxy due to aggressive blocking
const PROXY_REQUIRED_DOMAINS = [
  'fortune.com',
  'wsj.com',
  'wired.co.uk',
  'bloomberg.com',
];

function needsProxy(url) {
  if (!PROXY_ENABLED) return false;
  return PROXY_REQUIRED_DOMAINS.some(domain => url.includes(domain));
}

// ============================================================================
// ANTI-BLOCKING: User-Agent Rotation
// ============================================================================
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Track source health for adaptive behavior
const sourceHealth = new Map(); // url -> { failures: number, lastFailure: Date, backoffMs: number }

function getSourceHealth(url) {
  if (!sourceHealth.has(url)) {
    sourceHealth.set(url, { failures: 0, lastFailure: null, backoffMs: 0 });
  }
  return sourceHealth.get(url);
}

function recordSourceFailure(url) {
  const health = getSourceHealth(url);
  health.failures++;
  health.lastFailure = new Date();
  health.backoffMs = Math.min(health.backoffMs * 2 || 5000, 300000); // Max 5 min backoff
}

function recordSourceSuccess(url) {
  const health = getSourceHealth(url);
  health.failures = Math.max(0, health.failures - 1); // Slowly recover
  health.backoffMs = Math.max(0, health.backoffMs / 2);
}

function shouldSkipSource(url) {
  const health = getSourceHealth(url);
  if (health.failures >= 5 && health.lastFailure) {
    const timeSinceFailure = Date.now() - health.lastFailure.getTime();
    if (timeSinceFailure < health.backoffMs) {
      return true; // Still in backoff period
    }
  }
  return false;
}

// Create parser with rotating user agent and optional proxy
function createParser(url) {
  const config = {
    timeout: 30000,
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    }
  };
  
  // Add proxy for blocked domains
  if (needsProxy(url)) {
    try {
      config.requestOptions = {
        agent: new HttpsProxyAgent(PROXY_URL)
      };
      console.log(`   🔒 Using proxy for ${new URL(url).hostname}`);
    } catch (e) {
      console.log(`   ⚠️ Proxy config failed: ${e.message}`);
    }
  }
  
  return new Parser(config);
}

// Rate limiting with adaptive delays
const RATE_LIMIT_CONFIG = {
  DEFAULT_DELAY: 3000,
  RATE_LIMITED_SOURCES: {
    'techcrunch': 10000,
    'crunchbase': 20000,
    'hacker news': 45000,
    'fortune': 15000,
    'wired': 10000,
  }
};

function getSourceDelay(sourceName) {
  const lower = sourceName.toLowerCase();
  for (const [key, delay] of Object.entries(RATE_LIMIT_CONFIG.RATE_LIMITED_SOURCES)) {
    if (lower.includes(key)) return delay;
  }
  return RATE_LIMIT_CONFIG.DEFAULT_DELAY;
}

// Counters for triage (identify drop points)
const metrics = {
  rss_items_total: 0,
  events_inserted: 0,
  graph_edges_inserted: 0,
  reject_reasons: {},
  filtered_reasons: {},
  graph_safe_false_reasons: {},
};

function recordMetric(category, reason) {
  if (!metrics[category][reason]) {
    metrics[category][reason] = 0;
  }
  metrics[category][reason]++;
}

async function scrapeRssFeeds() {
  console.log('📡 SSOT-Compliant RSS Scraper (Parser is Source of Truth)');
  console.log('   Anti-blocking: UA rotation, adaptive delays, backoff\n');
  
  // Load ontology entities once and inject into parser
  // IMPORTANT: Only load STARTUP and INVESTOR types (skip GENERIC_TERM, PLACE, AMBIGUOUS)
  try {
    const { data: ontologyRows } = await supabase
      .from('entity_ontologies')
      .select('entity_name')
      .in('entity_type', ['STARTUP', 'INVESTOR'])  // Filter to concrete types only
      .limit(5000);
    setOntologyEntities((ontologyRows || []).map(r => r.entity_name).filter(Boolean));
    console.log(`   Ontology loaded: ${(ontologyRows || []).length} entities (STARTUP + INVESTOR only)`);
  } catch (e) {
    console.log('   ⚠️  Ontology load failed:', e?.message || e);
    setOntologyEntities([]);
  }
  
  // Get active RSS sources
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('id, name, url, category')
    .eq('active', true)
    .order('last_scraped', { ascending: true, nullsFirst: true })
    .limit(200);
  
  console.log(`Found ${sources?.length || 0} active RSS sources\n`);
  
  let skippedBackoff = 0;
  
  for (const source of sources || []) {
    // Check for graceful shutdown (PM2 cron_restart or manual stop)
    if (shuttingDown) {
      console.log('\n🛑 Graceful shutdown: stopping after current source');
      break;
    }
    
    // Check if source is in backoff due to repeated failures
    if (shouldSkipSource(source.url)) {
      const health = getSourceHealth(source.url);
      console.log(`⏸️  ${source.name} - skipping (${health.failures} failures, backoff ${Math.round(health.backoffMs/1000)}s)`);
      skippedBackoff++;
      continue;
    }
    
    // Adaptive delay: base + health-based adjustment
    const baseDelay = getSourceDelay(source.name);
    const health = getSourceHealth(source.url);
    const adaptiveDelay = baseDelay + (health.backoffMs / 2);
    await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
    
    console.log(`\n📰 ${source.name}`);
    console.log(`   ${source.url}`);
    
    try {
      // Create fresh parser with random UA for each request (with optional proxy)
      const parser = createParser(source.url);
      
      const feedPromise = parser.parseURL(source.url);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Feed timeout')), 30000)
      );
      
      const feed = await Promise.race([feedPromise, timeoutPromise]);
      const items = feed.items?.slice(0, 50) || [];
      
      console.log(`   Found ${items.length} items`);
      recordSourceSuccess(source.url); // Track success
      
      let added = 0;
      let graphJoins = 0;
      let rejected = 0;
      
      for (const item of items) {
        metrics.rss_items_total++;
        
        if (!item.title || !item.link) {
          rejected++;
          continue;
        }
        
        // PHASE 1: PARSER DECIDES (SSOT)
        // ==============================
        let frame, event;
        try {
          frame = parseFrameFromTitle(item.title);
          if (!frame) {
            rejected++;
            recordMetric('reject_reasons', 'no_frame_match');
            continue;
          }
          
          event = toCapitalEvent(
            frame,
            source.name,
            item.link,
            item.title,
            item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
          );
        } catch (err) {
          console.log(`   ⚠️  Parser error: ${err.message}`);
          rejected++;
          continue;
        }
        
        // PHASE 2A: ALWAYS STORE EVENT (even FILTERED/OTHER)
        // ===================================================
        if (event.extraction.decision === "REJECT") {
          rejected++;
          recordMetric('reject_reasons', event.extraction.reject_reason || 'unknown');
          continue;
        }
        
        // Store in startup_events table with UPSERT on event_id (100% coverage)
        let insertedEvent = null;
        try {
          // Upsert event (no pre-existence check needed — onConflict handles dedup)
          const { data: eventData, error: eventError } = await supabase
            .from('startup_events')
            .upsert({
              event_id: event.event_id,
              event_type: event.event_type,
              frame_type: event.frame_type,
              frame_confidence: event.frame_confidence,
              subject: event.subject,
              object: event.object,
              verb: event.verb,
              occurred_at: event.occurred_at,
              source_publisher: event.source.publisher,
              source_url: event.source.url,
              source_title: event.source.title,
              source_published_at: event.source.published_at,
              amounts: event.amounts,
              round: event.round,
              semantic_context: event.semantic_context,
              entities: event.entities,
              extraction_meta: event.extraction,
              notes: event.notes,
            }, { onConflict: 'event_id', ignoreDuplicates: false })
            .select('id, event_id')
            .single();

          if (eventError) {
            console.log(`   ⚠️  Event upsert failed: ${eventError.message}`);
          } else {
            insertedEvent = eventData;
            // Count as new if upsert created (can't distinguish easily, count all)
            added++;
            metrics.events_inserted++;
          }
        } catch (err) {
          console.log(`   ⚠️  Event upsert error: ${err.message}`);
        }
        
        // PHASE 2B: CONDITIONALLY CREATE GRAPH JOINS
        // ===========================================
        // ONLY when parser says graph_safe=true
        if (insertedEvent && event.extraction.graph_safe && event.entities.length > 0) {
          // Extract primary company name (SUBJECT role preferred)
          const primaryEntity = event.entities.find(e => e.role === "SUBJECT") || event.entities[0];
          
          // Try to create graph join into startup_uploads
          try {
            // Try extracting website from article link first
            let website = extractWebsite(item.link, item.content);
            
            // If article link is a publisher, try to find company URL in content
            if (!website && (item.content || item.contentSnippet)) {
              website = extractCompanyUrlFromContent(item.content || item.contentSnippet, primaryEntity.name);
            }
            
            // STRATEGY: Try website-based match first, then name-based match
            let existing = null;
            let existingError = null;
            
            if (website) {
              // Check if startup already exists by website
              const result = await supabase
                .from('startup_uploads')
                .select('id')
                .eq('website', website)
                .single();
              existing = result.data;
              existingError = result.error;
            } else {
              // FALLBACK: No website found — use name-based dedup
              // This handles the common case where article is on publisher domain
              const result = await supabase
                .from('startup_uploads')
                .select('id')
                .eq('name', primaryEntity.name)
                .eq('source_type', 'rss')
                .single();
              existing = result.data;
              existingError = result.error;
              console.log(`   🔍 Name-based lookup for "${primaryEntity.name}" (no website found)`);
            }

            let startupRow = existing;
            let startupError = null;

            // Only insert if the startup doesn't exist (existingError means no match)
            if (existingError) {
              // NAME QUALITY CHECK — reject garbage before DB insert
              const nameCheck = isValidStartupName(primaryEntity.name);
              if (!nameCheck.valid) {
                console.log(`   🚫 Name rejected: "${primaryEntity.name}" — ${nameCheck.reason}`);
                recordMetric('reject_reasons', `bad_name_${nameCheck.reason}`);
                continue;
              }
              
              // === V2 INFERENCE + REAL GOD SCORING ===
              const articleText = `${primaryEntity.name} ${event.source.title} ${item.contentSnippet || item.content || ''}`;
              let extractedData = {};
              let inferredSectors = detectSectors(event.source.title);
              let godScores = {};

              try {
                extractedData = extractInferenceData(articleText, website);
                // Use v2's 18-category sectors if available
                if (extractedData.sectors && extractedData.sectors.length > 0) {
                  inferredSectors = extractedData.sectors;
                }
                // Merge funding info from Phase-Change parser
                if (event.amounts && event.amounts.length > 0 && !extractedData.funding_amount) {
                  extractedData.funding_amount = event.amounts[0];
                }
                if (event.round && !extractedData.funding_stage) {
                  extractedData.funding_stage = event.round;
                }
                const confidence = assessConfidence(extractedData);
                extractedData.confidence = confidence;
                console.log(`   📊 Inference: ${primaryEntity.name} → Tier ${confidence.tier} (${confidence.score}/100)`);
              } catch (infErr) {
                console.log(`   ⚠️  Inference failed for ${primaryEntity.name}: ${infErr.message}`);
              }

              // Calculate REAL GOD score
              try {
                const startupForScoring = {
                  name: primaryEntity.name,
                  description: event.source.title.slice(0, 500),
                  website: website || '',
                  sectors: inferredSectors,
                  extracted_data: extractedData,
                };
                godScores = calculateGODScore(startupForScoring);
                console.log(`   🔥 GOD Score: ${primaryEntity.name} → ${godScores.total_god_score}/100`);
              } catch (scoreErr) {
                console.log(`   ⚠️  GOD Score failed for ${primaryEntity.name}: ${scoreErr.message}`);
                godScores = { total_god_score: 50 }; // Fallback only on error
              }

              // Auto-approve startups with GOD score >= 50, leave others as pending for admin review
              const autoApproveThreshold = 50;
              const startupStatus = (godScores.total_god_score || 0) >= autoApproveThreshold ? 'approved' : 'pending';
              
              // Create new startup with v2 inference data + real GOD score
              const { data: newRow, error: err } = await supabase
                .from('startup_uploads')
                .insert({
                  name: primaryEntity.name,
                  description: event.source.title.slice(0, 500),
                  website: website || null, // Use null instead of '' to avoid unique constraint on empty strings
                  status: startupStatus,
                  sectors: inferredSectors,
                  source_type: 'rss',
                  source_url: event.source.url,
                  discovery_event_id: insertedEvent.id,
                  extracted_data: Object.keys(extractedData).length > 0 ? extractedData : null,
                  tagline: extractedData.tagline || null,
                  ...godScores,
                })
                .select('id')
                .single();
              
              if (startupStatus === 'approved') {
                console.log(`   ✅ Auto-approved: ${primaryEntity.name} (GOD: ${godScores.total_god_score})`);
              } else {
                console.log(`   ⏳ Pending review: ${primaryEntity.name} (GOD: ${godScores.total_god_score} < ${autoApproveThreshold})`);
              }
              startupRow = newRow;
              startupError = err;
            }

            if (!startupError && startupRow) {
              graphJoins++;
              metrics.graph_edges_inserted++;
            } else if (startupError) {
              console.log(`   ⚠️  Graph join failed for ${primaryEntity.name}: ${startupError.message}`);
            }
          } catch (err) {
            // Log graph join errors (event is still stored)
            console.log(`   ⚠️  Graph join error for ${primaryEntity?.name || 'unknown'}: ${err?.message || err}`);
          }
        } else {
          // Record why graph join was skipped
          if (event.event_type === "FILTERED") {
            recordMetric('graph_safe_false_reasons', 'FILTERED_event_type');
          } else if (event.frame_confidence < 0.8) {
            recordMetric('graph_safe_false_reasons', 'low_confidence');
          } else if (event.entities.length === 0) {
            recordMetric('graph_safe_false_reasons', 'no_entities');
          } else {
            recordMetric('graph_safe_false_reasons', 'other');
          }
        }
        
        // Record filtered reason if present
        if (event.extraction.filtered_reason) {
          recordMetric('filtered_reasons', event.extraction.filtered_reason);
        }
      }
      
      console.log(`   ✅ Events stored: ${added} | Graph joins: ${graphJoins} | Rejected: ${rejected}`);
      
      // Update last_scraped + discovery stats
      const discoveryCount = added + graphJoins; // Count both events and graph joins as discoveries
      const updateData = { 
        last_scraped: new Date().toISOString(),
        consecutive_failures: 0
      };
      
      // Increment total_discoveries
      if (discoveryCount > 0) {
        const { data: currentSource } = await supabase
          .from('rss_sources')
          .select('total_discoveries, avg_yield_per_scrape')
          .eq('id', source.id)
          .single();
        
        const prevTotal = (currentSource?.total_discoveries || 0);
        const newTotal = prevTotal + discoveryCount;
        updateData.total_discoveries = newTotal;
        
        // Calculate rolling average yield (simple moving average)
        const prevAvg = (currentSource?.avg_yield_per_scrape || 0);
        updateData.avg_yield_per_scrape = prevAvg > 0 
          ? Math.round((prevAvg * 0.8 + discoveryCount * 0.2) * 100) / 100
          : discoveryCount;
      }
      
      await supabase
        .from('rss_sources')
        .update(updateData)
        .eq('id', source.id);
      
    } catch (err) {
      // Track failure for adaptive backoff
      recordSourceFailure(source.url);
      const health = getSourceHealth(source.url);
      
      // Classify error type
      const errMsg = err.message || '';
      let errorType = 'UNKNOWN';
      if (errMsg.includes('timeout')) errorType = 'TIMEOUT';
      else if (errMsg.includes('403')) errorType = 'FORBIDDEN';
      else if (errMsg.includes('429')) errorType = 'RATE_LIMITED';
      else if (errMsg.includes('404')) errorType = 'NOT_FOUND';
      else if (errMsg.includes('ECONNREFUSED')) errorType = 'CONNECTION_REFUSED';
      else if (errMsg.includes('ENOTFOUND')) errorType = 'DNS_FAILED';
      
      console.log(`   ❌ ${errorType}: ${errMsg}`);
      console.log(`      Failures: ${health.failures}, Next backoff: ${Math.round(health.backoffMs/1000)}s`);
    }
  }
  
  // Print metrics for triage
  console.log('\n📊 SSOT METRICS (Triage)');
  console.log('='.repeat(60));
  console.log(`RSS Items Total:       ${metrics.rss_items_total}`);
  console.log(`Events Inserted:       ${metrics.events_inserted}`);
  console.log(`Graph Edges Inserted:  ${metrics.graph_edges_inserted}`);
  console.log(`Sources Skipped (backoff): ${skippedBackoff}`);
  console.log();
  
  if (Object.keys(metrics.reject_reasons).length > 0) {
    console.log('Reject Reasons:');
    Object.entries(metrics.reject_reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([reason, count]) => {
        console.log(`  • ${reason}: ${count}`);
      });
    console.log();
  }
  
  if (Object.keys(metrics.filtered_reasons).length > 0) {
    console.log('Filtered Reasons:');
    Object.entries(metrics.filtered_reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([reason, count]) => {
        console.log(`  • ${reason}: ${count}`);
      });
    console.log();
  }
  
  if (Object.keys(metrics.graph_safe_false_reasons).length > 0) {
    console.log('Graph Safe=false Reasons:');
    Object.entries(metrics.graph_safe_false_reasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`  • ${reason}: ${count}`);
      });
    console.log();
  }
  
  console.log('='.repeat(60));
}

// ============================================================================
// NAME QUALITY VALIDATION
// Catches concatenated/garbage names before they enter the database
// ============================================================================
const COMMON_CITIES = new Set([
  'san francisco', 'new york', 'london', 'berlin', 'tokyo', 'paris', 'boston',
  'seattle', 'austin', 'chicago', 'los angeles', 'miami', 'denver', 'toronto',
  'singapore', 'bangalore', 'tel aviv', 'amsterdam', 'stockholm', 'dublin',
  'mountain view', 'palo alto', 'menlo park', 'redwood city', 'sunnyvale',
]);

const BATCH_SEASONS = /\b(W|S|F|Winter|Summer|Fall|Spring)\s*\d{2,4}\b/i;

function isValidStartupName(name) {
  if (!name || typeof name !== 'string') return { valid: false, reason: 'empty' };
  const trimmed = name.trim();
  
  // Too long (likely concatenated data)
  if (trimmed.length > 60) return { valid: false, reason: `too_long (${trimmed.length} chars)` };
  
  // Too short
  if (trimmed.length < 2) return { valid: false, reason: 'too_short' };
  
  // Contains batch/season indicators (YC bad name pattern)
  if (BATCH_SEASONS.test(trimmed)) return { valid: false, reason: 'contains_batch_season' };
  
  // Contains city name (concatenation artifact)
  const lower = trimmed.toLowerCase();
  for (const city of COMMON_CITIES) {
    // Only flag if city appears as a suffix (not the whole name or prefix of a real name)
    if (lower.length > city.length + 3 && lower.endsWith(city)) {
      return { valid: false, reason: `city_suffix (${city})` };
    }
  }
  
  // Multiple capital words without spaces (CamelCase concatenation)
  const camelBoundaries = trimmed.match(/[a-z][A-Z]/g);
  if (camelBoundaries && camelBoundaries.length >= 3) {
    return { valid: false, reason: 'excessive_camelcase' };
  }
  
  // Contains common description fragments
  if (/\b(platform for|helps? |enables?|automates?|provides?|delivers?)\b/i.test(trimmed) && trimmed.length > 30) {
    return { valid: false, reason: 'contains_description' };
  }
  
  return { valid: true };
}

// PUBLISHER DOMAINS TO BLOCK (these are article sources, not company websites)
// Also used by name validation below
const PUBLISHER_DOMAINS = new Set([
  'techcrunch.com', 'businessinsider.com', 'entrepreneur.com', 'forbes.com',
  'cnbc.com', 'theverge.com', 'wired.com', 'fastcompany.com', 'inc.com',
  'wsj.com', 'nytimes.com', 'medium.com', 'twitter.com', 'linkedin.com',
  'reddit.com', 'ycombinator.com', 'venturebeat.com', 'arstechnica.com',
  'bloomberg.com', 'reuters.com', 'bbc.com', 'cnn.com', 'theguardian.com',
  'axios.com', 'strictlyvc.com', 'avc.com', 'mattermark.com', 'dealroom.co',
  'crunchbase.com', 'pitchbook.com', 'finsmes.com', 'pulse2.com', 'inc42.com',
  'theblock.co', 'coindesk.com', 'decrypt.co', 'cointelegraph.com', 'zdnet.com',
  'engadget.com', 'gizmodo.com', 'mashable.com', 'theregister.com', 'techmeme.com',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'news.ycombinator.com',
  'producthunt.com', 'betalist.com', 'angellist.com', 'substack.com', 'mirror.xyz',
  'google.com', 'google.co', 'apple.com', 'amazon.com', 'microsoft.com', 'ibm.com',
  'walmart.com', 'target.com', 'bestbuy.com', 'costco.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'x.com', 'threads.net',
  'youtube.com', 'spotify.com', 'netflix.com', 'twitch.tv',
]);

// Helper: Extract company URL from article content (HTML)
// When the article link is a publisher domain, look inside the content for company URLs
function extractCompanyUrlFromContent(content, entityName) {
  if (!content) return '';
  try {
    // Look for href links in HTML content that aren't publisher domains
    const hrefPattern = /href=["'](https?:\/\/[^"'\s]+)["']/gi;
    const matches = [...content.matchAll(hrefPattern)];
    
    for (const match of matches) {
      try {
        const url = new URL(match[1]);
        const domain = url.hostname.replace('www.', '').toLowerCase();
        
        // Skip publisher domains, social media, and generic sites
        if (PUBLISHER_DOMAINS.has(domain)) continue;
        if (domain.includes('news.') || domain.includes('blog.') || 
            domain.endsWith('.medium.com') || domain.includes('substack.')) continue;
        // Skip image/CDN/tracking domains
        if (domain.includes('cdn.') || domain.includes('img.') || 
            domain.includes('pixel.') || domain.includes('analytics.') ||
            domain.includes('tracking.') || domain.includes('googleusercontent')) continue;
        // Skip common non-company domains
        if (['t.co', 'bit.ly', 'goo.gl', 'ow.ly', 'fb.me', 'youtu.be',
             'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com',
             'x.com', 'threads.net', 'pinterest.com', 'wikipedia.org',
             'testflight.apple.com', 'apps.apple.com', 'play.google.com'].includes(domain)) continue;
        
        // Prefer domain that matches entity name
        const entityLower = (entityName || '').toLowerCase().replace(/\s+/g, '');
        if (entityLower.length >= 3 && domain.includes(entityLower.slice(0, Math.min(entityLower.length, 10)))) {
          return domain;
        }
        
        // Otherwise return the first non-publisher link found
        // (usually the company's website in press articles)
        return domain;
      } catch {
        continue;
      }
    }
    return '';
  } catch {
    return '';
  }
}

// Helper: Extract website from link or content
// CRITICAL: Do NOT store publisher domains as company websites!
function extractWebsite(link, content) {
  if (!link) return '';
  try {
    const url = new URL(link);
    const domain = url.hostname.replace('www.', '').toLowerCase();
    
    // BLOCK publisher domains - these are NOT company websites
    if (PUBLISHER_DOMAINS.has(domain)) {
      return ''; // Return empty - don't store article URL as company website
    }
    
    // Also block if domain contains common publisher patterns
    if (domain.includes('news.') || domain.includes('blog.') || 
        domain.endsWith('.medium.com') || domain.includes('substack.')) {
      return '';
    }
    
    return domain;
  } catch {
    return '';
  }
}

// Helper: Detect sectors (expanded from 5 to 15 categories)
function detectSectors(text) {
  const sectors = [];
  const lowerText = text.toLowerCase();
  
  const sectorKeywords = {
    'AI/ML': ['artificial intelligence', ' ai ', 'machine learning', 'llm', 'deep learning', 'neural network', 'generative ai', 'genai', 'gpt', 'language model'],
    'FinTech': ['fintech', 'financial', 'banking', 'payments', 'neobank', 'lending', 'insurtech', 'defi'],
    'HealthTech': ['healthtech', 'healthcare', 'medical', 'biotech', 'telemedicine', 'digital health', 'pharma'],
    'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software'],
    'Climate': ['climate', 'cleantech', 'sustainability', 'carbon', 'renewable', 'solar', 'green energy', 'ev '],
    'Developer Tools': ['developer tool', 'devtool', 'dev tool', 'sdk', 'api platform', 'code editor', 'ide ', 'ci/cd', 'version control', 'git '],
    'Infrastructure': ['infrastructure', 'cloud computing', 'serverless', 'kubernetes', 'container', 'microservice', 'data pipeline', 'orchestration'],
    'DevOps': ['devops', 'sre ', 'site reliability', 'monitoring', 'observability', 'incident management', 'deployment'],
    'Cybersecurity': ['cybersecurity', 'security', 'threat detection', 'zero trust', 'encryption', 'vulnerability', 'pentest', 'siem'],
    'Data/Analytics': ['data analytics', 'data warehouse', 'data lake', 'business intelligence', ' bi ', 'etl', 'data integration', 'database'],
    'Web3/Crypto': ['web3', 'blockchain', 'crypto', 'nft', 'dao', 'defi', 'ethereum', 'solana', 'token'],
    'EdTech': ['edtech', 'education', 'e-learning', 'online learning', 'tutoring', 'courseware'],
    'PropTech': ['proptech', 'real estate', 'property tech', 'mortgage', 'housing'],
    'E-Commerce': ['e-commerce', 'ecommerce', 'marketplace', 'shopify', 'retail tech', 'd2c', 'dtc'],
    'Logistics': ['logistics', 'supply chain', 'freight', 'shipping', 'warehouse', 'last mile', 'delivery'],
  };
  
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      sectors.push(sector);
    }
  }
  
  return sectors.length > 0 ? sectors : ['Technology'];
}

// Run scraper
scrapeRssFeeds()
  .then(() => {
    console.log('\n✅ Scraper completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Scraper failed:', err);
    process.exit(1);
  });
