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
 */

require('dotenv').config({ path: '.env.bak' });
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

// Import Phase-Change parser directly (tsx handles TypeScript)
const { parseFrameFromTitle, toCapitalEvent, setOntologyEntities } = require('../../src/services/rss/frameParser.ts');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/2.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  }
});

// Rate limiting
const RATE_LIMIT_CONFIG = {
  DEFAULT_DELAY: 3000,
  RATE_LIMITED_SOURCES: {
    'techcrunch': 10000,
    'crunchbase': 20000,
    'hacker news': 45000,
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
  console.log('📡 SSOT-Compliant RSS Scraper (Parser is Source of Truth)\n');
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
    .limit(100);
  
  console.log(`Found ${sources?.length || 0} active RSS sources\n`);
  
  for (const source of sources || []) {
    const delay = getSourceDelay(source.name);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`\n📰 ${source.name}`);
    console.log(`   ${source.url}`);
    
    try {
      const feedPromise = parser.parseURL(source.url);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Feed timeout')), 30000)
      );
      
      const feed = await Promise.race([feedPromise, timeoutPromise]);
      const items = feed.items?.slice(0, 50) || [];
      
      console.log(`   Found ${items.length} items`);
      
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
          // Check existence to count new vs updated accurately
          const { data: preExisting } = await supabase
            .from('startup_events')
            .select('id')
            .eq('event_id', event.event_id)
            .single();

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
            }, { onConflict: 'event_id' })
            .select()
            .single();

          if (eventError) {
            console.log(`   ⚠️  Event upsert failed: ${eventError.message}`);
          } else {
            insertedEvent = eventData;
            if (!preExisting) {
              added++;
              metrics.events_inserted++;
            } else {
              // Existing event updated
            }
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
          
          // Try to create graph join into startup_uploads (check by website first)
          try {
            const website = extractWebsite(item.link, item.content);
            if (!website) {
              // Fallback: skip when website not detected to avoid bad upserts
              // We still count graph join only when we have a reliable identity
            } else {
              // Check if startup already exists by website
              const { data: existing, error: existingError } = await supabase
                .from('startup_uploads')
                .select('id')
                .eq('website', website)
                .single();

              let startupRow = existing;
              let startupError = null;

              // Only insert if the startup doesn't exist (existingError means no match)
              if (existingError) {
                // Create new startup only if website doesn't exist
                const { data: newRow, error: err } = await supabase
                  .from('startup_uploads')
                  .insert({
                    name: primaryEntity.name,
                    description: event.source.title.slice(0, 500),
                    website,
                    status: 'pending',
                    sectors: detectSectors(event.source.title),
                    source_type: 'rss',
                    source_url: event.source.url,
                    discovery_event_id: insertedEvent.id,
                  })
                  .select('id')
                  .single();
                startupRow = newRow;
                startupError = err;
              }

              if (!startupError && startupRow) {
                graphJoins++;
                metrics.graph_edges_inserted++;
              } else if (startupError) {
                console.log(`   ⚠️  Graph join failed for ${primaryEntity.name}: ${startupError.message}`);
              }
            }
          } catch (err) {
            // Silently skip graph join errors (event is still stored)
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
      
      // Update last_scraped
      await supabase
        .from('rss_sources')
        .update({ last_scraped: new Date().toISOString() })
        .eq('id', source.id);
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }
  
  // Print metrics for triage
  console.log('\n📊 SSOT METRICS (Triage)');
  console.log('='.repeat(60));
  console.log(`RSS Items Total:       ${metrics.rss_items_total}`);
  console.log(`Events Inserted:       ${metrics.events_inserted}`);
  console.log(`Graph Edges Inserted:  ${metrics.graph_edges_inserted}`);
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

// PUBLISHER DOMAINS TO BLOCK (these are article sources, not company websites)
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
]);

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

// Helper: Detect sectors
function detectSectors(text) {
  const sectors = [];
  const lowerText = text.toLowerCase();
  
  const sectorKeywords = {
    'AI/ML': ['artificial intelligence', ' ai ', 'machine learning', 'llm'],
    'FinTech': ['fintech', 'financial', 'banking', 'payments'],
    'HealthTech': ['healthtech', 'healthcare', 'medical', 'biotech'],
    'SaaS': ['saas', 'software as a service', 'b2b software'],
    'Climate': ['climate', 'cleantech', 'sustainability', 'carbon'],
  };
  
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      sectors.push(sector);
    }
  }
  
  return sectors.length > 0 ? sectors : ['Technology'];
}

// Run scraper
scrapeRssFeeds().catch(console.error);
