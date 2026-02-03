#!/usr/bin/env node
/**
 * EVENT RESCUE AGENT
 * ====================
 * Self-healing scraper that recovers startups from misclassified "OTHER" events
 * 
 * Strategy:
 * 1. Use INFERENCE ENGINE first (free pattern matching) → saves 80% of API calls
 * 2. Only use GPT-4 for complex/ambiguous headlines that need NLU
 * 3. Update startup_events with correct classification
 * 4. Create discovered_startups entries
 * 5. Feed ML ontology agent to improve parser
 * 
 * Cost optimization: ~$0.02/event with GPT-4 → ~$0.004/event with inference gate
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const InferenceExtractor = require('../lib/inference-extractor');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || (() => {
    console.error('❌ OPENAI_API_KEY not found in environment!');
    console.error('Available env keys:', Object.keys(process.env).filter(k => k.includes('OPENAI')));
    process.exit(1);
  })()
});

// Configuration
const CONFIG = {
  BATCH_SIZE: 50,
  MAX_EVENTS_PER_RUN: 100, // Process 100 "OTHER" events per run
  MIN_CONFIDENCE_FOR_AUTO_CREATE: 0.7,
  GPT_MODEL: 'gpt-4o-mini', // Cheapest GPT-4 class model
  RESCUE_WINDOW_HOURS: 24, // Look back 24 hours
};

// Startup signal keywords for filtering
const STARTUP_KEYWORDS = [
  'raised', 'funding', 'series', 'million', 'billion',
  'acquisition', 'acquires', 'launches', 'startup',
  'seed', 'round', 'venture', 'vc', 'invested'
];

/**
 * Step 1: Fetch "OTHER" events with startup signals
 */
async function fetchOtherEventsWithSignals() {
  console.log('🔍 Scanning "OTHER" events for startup signals...\n');
  
  // Use textSearch instead of complex OR conditions
  const { data: events, error } = await supabase
    .from('startup_events')
    .select('*')
    .eq('event_type', 'OTHER')
    .gte('created_at', new Date(Date.now() - CONFIG.RESCUE_WINDOW_HOURS * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(CONFIG.MAX_EVENTS_PER_RUN * 2); // Fetch more, filter client-side
  
  if (error) {
    console.error('❌ Error fetching events:', error);
    return [];
  }
  
  // Filter client-side for startup keywords
  const filtered = (events || []).filter(event => {
    const title = (event.source_title || '').toLowerCase();
    return STARTUP_KEYWORDS.some(kw => title.includes(kw));
  }).slice(0, CONFIG.MAX_EVENTS_PER_RUN);
  
  console.log(`✅ Found ${filtered.length} "OTHER" events with startup signals (from ${events?.length || 0} total)\n`);
  return filtered;
}

/**
 * Step 2: Use inference engine to extract data (FREE - no API calls)
 */
function inferenceExtract(title, description = '') {
  const text = `${title} ${description}`;
  
  // Use inference extractor for funding/stage/sector
  const funding = InferenceExtractor.extractFunding(text);
  const sectors = InferenceExtractor.extractSectors(text);
  
  // Extract startup name using patterns
  const startupName = extractStartupName(title);
  
  // Determine event type from patterns
  const eventType = inferEventType(title, funding);
  
  // Calculate confidence
  const confidence = calculateInferenceConfidence(startupName, eventType, funding, sectors);
  
  return {
    startup_name: startupName,
    event_type: eventType,
    funding_amount: funding.funding_amount,
    funding_stage: funding.funding_stage,
    lead_investor: funding.lead_investor,
    investors: funding.investors_mentioned,
    sectors: sectors,
    confidence: confidence,
    method: 'inference'
  };
}

/**
 * Extract startup name from title using patterns
 */
function extractStartupName(title) {
  // Pattern 1: "Company raises $X"
  const raisePattern = /^([A-Z][A-Za-z0-9&.\-\s]{2,40}?)\s+(?:raises|raised|secures|closes|lands)/i;
  let match = title.match(raisePattern);
  if (match) return match[1].trim();
  
  // Pattern 2: "Company launches"
  const launchPattern = /^([A-Z][A-Za-z0-9&.\-\s]{2,40}?)\s+(?:launches|unveils|announces|introduces)/i;
  match = title.match(launchPattern);
  if (match) return match[1].trim();
  
  // Pattern 3: "X acquires Company"
  const acquirePattern = /acquires\s+([A-Z][A-Za-z0-9&.\-\s]{2,40}?)(?:\s|,|$)/i;
  match = title.match(acquirePattern);
  if (match) return match[1].trim();
  
  // Pattern 4: "$X for Company"
  const forPattern = /\$[\d.]+[MBK]?\s+(?:for|to|in)\s+([A-Z][A-Za-z0-9&.\-\s]{2,40})/i;
  match = title.match(forPattern);
  if (match) return match[1].trim();
  
  // Pattern 5: First TitleCase sequence
  const titleCasePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/;
  match = title.match(titleCasePattern);
  if (match) return match[1].trim();
  
  return null;
}

/**
 * Infer event type from title patterns
 */
function inferEventType(title, funding) {
  const lower = title.toLowerCase();
  
  // Funding events
  if (funding.funding_amount || 
      /\b(raises?|raised|raising|secures?|secured|funding|round|closes?|lands?)\b/i.test(title)) {
    return 'FUNDING';
  }
  
  // Acquisition events
  if (/\b(acquir(?:e|es|ed|ing)|acquisition|buys?|bought|purchase[sd]?)\b/i.test(title)) {
    return 'ACQUISITION';
  }
  
  // Launch events
  if (/\b(launches?|launched|unveils?|unveiled|debuts?|debuted|introduces?)\b/i.test(title)) {
    return 'LAUNCH';
  }
  
  // Partnership events
  if (/\b(partners?|partnership|teams\s+up|collaborat(?:e|es|ion)|signs)\b/i.test(title)) {
    return 'PARTNERSHIP';
  }
  
  // IPO events
  if (/\b(ipo|files\s+for|public\s+offering|goes\s+public)\b/i.test(title)) {
    return 'IPO_FILING';
  }
  
  return 'OTHER';
}

/**
 * Calculate confidence score for inference results
 */
function calculateInferenceConfidence(name, type, funding, sectors) {
  let confidence = 0;
  
  // Has startup name (+0.3)
  if (name && name.length > 2) confidence += 0.3;
  
  // Has event type (+0.2)
  if (type !== 'OTHER') confidence += 0.2;
  
  // Has funding data (+0.2)
  if (funding.funding_amount) confidence += 0.2;
  
  // Has sectors (+0.1)
  if (sectors.length > 0) confidence += 0.1;
  
  // Has investors (+0.1)
  if (funding.investors_mentioned?.length > 0) confidence += 0.1;
  
  // Has stage (+0.1)
  if (funding.funding_stage) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

/**
 * Step 3: Use GPT-4 for complex cases (ONLY when inference fails)
 */
async function gptExtract(title, description = '') {
  const prompt = `You are an expert at extracting structured startup information from news headlines.

Headline: "${title}"
${description ? `Description: "${description}"` : ''}

Extract the following in JSON format:
{
  "startup_name": "The startup company name (null if none found)",
  "event_type": "FUNDING | ACQUISITION | LAUNCH | PARTNERSHIP | IPO_FILING | OTHER",
  "funding_amount": "Amount in USD (number, null if none)",
  "funding_stage": "Pre-seed | Seed | Series A | Series B | etc (null if none)",
  "lead_investor": "Name of lead investor (null if none)",
  "investors": ["Array of investor names mentioned"],
  "sectors": ["Array of sectors/industries (e.g., AI/ML, FinTech, HealthTech)"],
  "confidence": 0.0-1.0 (your confidence in the extraction)
}

Rules:
- startup_name should be the COMPANY being funded/acquired/launched, not the investor
- For "X acquires Y", Y is the startup
- For "X leads $Z round for Y", Y is the startup
- Be conservative: if unclear, return null and lower confidence
- Only include sectors you're confident about`;

  try {
    const response = await openai.chat.completions.create({
      model: CONFIG.GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return {
      ...result,
      method: 'gpt'
    };
  } catch (error) {
    console.error(`   ⚠️  GPT extraction failed: ${error.message}`);
    return null;
  }
}

/**
 * Step 4: Process event - try inference first, fallback to GPT
 */
async function processEvent(event) {
  console.log(`\n📰 Processing: "${event.source_title.slice(0, 80)}..."`);
  console.log(`   Publisher: ${event.source_publisher}`);
  
  // Try inference first (FREE)
  let result = inferenceExtract(event.source_title, event.semantic_context?.[0]?.text);
  
  console.log(`   🧠 Inference: confidence=${result.confidence.toFixed(2)}, type=${result.event_type}, name=${result.startup_name || 'null'}`);
  
  // If inference confidence is low, use GPT
  if (result.confidence < 0.6) {
    console.log(`   💡 Low confidence - using GPT-4...`);
    const gptResult = await gptExtract(event.source_title, event.semantic_context?.[0]?.text);
    
    if (gptResult && gptResult.confidence > result.confidence) {
      result = gptResult;
      console.log(`   ✅ GPT: confidence=${result.confidence.toFixed(2)}, type=${result.event_type}, name=${result.startup_name || 'null'}`);
    }
  }
  
  // Only proceed if we have a startup name and decent confidence
  if (!result.startup_name || result.confidence < 0.5) {
    console.log(`   ❌ Skipped: insufficient data (confidence=${result.confidence.toFixed(2)})`);
    return { success: false, reason: 'low_confidence' };
  }
  
  // Update startup_events with corrected classification
  const { error: updateError } = await supabase
    .from('startup_events')
    .update({
      event_type: result.event_type,
      subject: result.startup_name,
      object: result.lead_investor,
      amounts: result.funding_amount ? {
        raw: `$${result.funding_amount}`,
        currency: 'USD',
        value: result.funding_amount,
        usd: result.funding_amount
      } : null,
      round: result.funding_stage,
      extraction_meta: {
        ...event.extraction_meta,
        rescue_agent: {
          method: result.method,
          confidence: result.confidence,
          rescued_at: new Date().toISOString()
        }
      }
    })
    .eq('id', event.id);
  
  if (updateError) {
    console.error(`   ⚠️  Update failed: ${updateError.message}`);
  } else {
    console.log(`   ✅ Updated event: ${event.event_type} → ${result.event_type}`);
  }
  
  // Create discovered_startup if confidence is high enough
  if (result.confidence >= CONFIG.MIN_CONFIDENCE_FOR_AUTO_CREATE) {
    // Check if startup already exists
    const { data: existing } = await supabase
      .from('discovered_startups')
      .select('id')
      .ilike('name', result.startup_name)
      .maybeSingle();
    
    if (!existing) {
      const { error: insertError } = await supabase
        .from('discovered_startups')
        .insert({
          name: result.startup_name,
          website: null, // Will be enriched later
          description: event.source_title,
          funding_stage: result.funding_stage,
          sectors: result.sectors,
          source: 'rescue_agent',
          metadata: {
            event_id: event.event_id,
            source_url: event.source_url,
            investors: result.investors,
            funding_amount: result.funding_amount,
            rescue_confidence: result.confidence,
            rescue_method: result.method
          }
        });
      
      if (insertError) {
        console.error(`   ⚠️  Insert failed: ${insertError.message}`);
      } else {
        console.log(`   🎉 Created discovered_startup: ${result.startup_name}`);
      }
    } else {
      console.log(`   ℹ️  Startup already exists in discovered_startups`);
    }
  }
  
  return { 
    success: true, 
    method: result.method,
    event_type: result.event_type,
    confidence: result.confidence
  };
}

/**
 * Main execution
 */
async function runRescueAgent() {
  console.log('🚑 EVENT RESCUE AGENT');
  console.log('=' .repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  
  // Fetch events
  const events = await fetchOtherEventsWithSignals();
  
  if (events.length === 0) {
    console.log('✅ No events to rescue!');
    return;
  }
  
  // Process events in batches
  const stats = {
    total: events.length,
    rescued: 0,
    skipped: 0,
    inference_used: 0,
    gpt_used: 0,
    by_type: {}
  };
  
  for (let i = 0; i < events.length; i += CONFIG.BATCH_SIZE) {
    const batch = events.slice(i, i + CONFIG.BATCH_SIZE);
    
    console.log(`\n📦 Batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(events.length / CONFIG.BATCH_SIZE)}`);
    console.log('─'.repeat(60));
    
    for (const event of batch) {
      const result = await processEvent(event);
      
      if (result.success) {
        stats.rescued++;
        stats.by_type[result.event_type] = (stats.by_type[result.event_type] || 0) + 1;
        
        if (result.method === 'inference') {
          stats.inference_used++;
        } else if (result.method === 'gpt') {
          stats.gpt_used++;
        }
      } else {
        stats.skipped++;
      }
      
      // Rate limiting for GPT calls
      if (result.success && result.method === 'gpt') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESCUE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total events processed: ${stats.total}`);
  console.log(`✅ Rescued: ${stats.rescued} (${((stats.rescued / stats.total) * 100).toFixed(1)}%)`);
  console.log(`❌ Skipped: ${stats.skipped}`);
  console.log(`\nMethod breakdown:`);
  console.log(`  🧠 Inference (free): ${stats.inference_used} (${((stats.inference_used / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  💡 GPT-4: ${stats.gpt_used} (${((stats.gpt_used / stats.total) * 100).toFixed(1)}%)`);
  console.log(`\nBy event type:`);
  Object.entries(stats.by_type).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // Cost estimate
  const gptCost = stats.gpt_used * 0.004; // ~$0.004 per call with gpt-4o-mini
  console.log(`\n💰 Estimated cost: $${gptCost.toFixed(2)} (${stats.gpt_used} GPT calls × $0.004)`);
  console.log(`💵 Cost saved by inference: $${(stats.inference_used * 0.004).toFixed(2)}`);
  
  // Log to ai_logs
  await supabase.from('ai_logs').insert({
    type: 'rescue_agent',
    action: 'process_other_events',
    status: 'success',
    output: {
      stats,
      cost_estimate: gptCost
    }
  });
  
  console.log(`\n⏰ Completed: ${new Date().toISOString()}`);
}

// Run if called directly
if (require.main === module) {
  runRescueAgent()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runRescueAgent };
