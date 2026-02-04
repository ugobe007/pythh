#!/usr/bin/env node
/**
 * ML Ontology Learning Agent
 * Separate instance from GOD scoring - focuses on entity classification
 * 
 * Purpose: Analyze RSS patterns and suggest ontology improvements
 * Input: discovered_startups, startup_events tables
 * Output: Suggested entity_ontologies entries
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const envPath = process.env.ENV_FILE || '.env.bak';
require('dotenv').config({ path: envPath });

// Use service role key for automated background operations (bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Use OpenAI for efficient classification
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

// Configuration
const CONFIG = {
  BATCH_SIZE: 50,
  MIN_OCCURRENCES: 3, // Entity must appear 3+ times to be analyzed
  CONFIDENCE_THRESHOLD: 0.7,
  AUTO_APPLY_THRESHOLD: 0.85, // Auto-apply if confidence >= 85%
  AUTO_APPLY_ENABLED: true, // Fully automated mode
  MODEL: 'gpt-4o-mini', // Fast and cheap for classification
  // Rate limiting & circuit breaker
  BASE_DELAY_MS: 1000,           // Base delay between API calls
  MAX_DELAY_MS: 60000,           // Max delay (1 minute)
  CIRCUIT_BREAKER_THRESHOLD: 5, // Open circuit after 5 consecutive failures
  CIRCUIT_BREAKER_RESET_MS: 300000, // Reset circuit after 5 minutes
  MAX_RETRIES: 3,                // Max retries per request
};

// Circuit breaker state
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
      this.isOpen = true;
      console.log(`🔴 CIRCUIT BREAKER OPEN - Too many failures (${this.failures}). Pausing for ${CONFIG.CIRCUIT_BREAKER_RESET_MS / 1000}s`);
    }
  },
  
  recordSuccess() {
    this.failures = 0;
    this.isOpen = false;
  },
  
  canProceed() {
    if (!this.isOpen) return true;
    // Check if reset period has passed
    if (Date.now() - this.lastFailure > CONFIG.CIRCUIT_BREAKER_RESET_MS) {
      console.log('🟢 CIRCUIT BREAKER RESET - Resuming operations');
      this.isOpen = false;
      this.failures = 0;
      return true;
    }
    return false;
  }
};

// Exponential backoff helper
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt) {
  const delay = Math.min(
    CONFIG.BASE_DELAY_MS * Math.pow(2, attempt),
    CONFIG.MAX_DELAY_MS
  );
  // Add jitter (±25%)
  return delay * (0.75 + Math.random() * 0.5);
}

// ============================================================================
// PATTERN-BASED PRE-CLASSIFICATION (Saves 80%+ of API calls!)
// ============================================================================
const KNOWN_VCS = [
  'sequoia', 'andreessen', 'a16z', 'benchmark', 'greylock', 'lightspeed', 
  'accel', 'kleiner', 'gv', 'nea', 'bessemer', 'index ventures', 'ggv',
  'tiger global', 'coatue', 'insight partners', 'general catalyst', 'ivp',
  'khosla', 'founders fund', 'spark capital', 'battery ventures', 'dst',
  'ribbit', 'qed', 'nyca', 'first round', 'initialized', 'sv angel',
  'y combinator', 'yc', 'techstars', '500 startups'
];

const KNOWN_PLACES = [
  'united states', 'usa', 'uk', 'europe', 'asia', 'india', 'china', 'japan',
  'silicon valley', 'san francisco', 'new york', 'boston', 'london', 'berlin',
  'singapore', 'hong kong', 'tel aviv', 'toronto', 'los angeles', 'seattle',
  'austin', 'miami', 'chicago', 'denver', 'paris', 'amsterdam', 'stockholm'
];

const GENERIC_TERMS = [
  'startup', 'startups', 'company', 'companies', 'investor', 'investors',
  'venture capital', 'vc', 'vcs', 'funding', 'round', 'deal', 'deals',
  'unicorn', 'unicorns', 'founder', 'founders', 'tech', 'technology',
  'ai', 'ml', 'saas', 'fintech', 'healthtech', 'market', 'industry',
  'researchers', 'scientists', 'executives', 'leaders', 'analysts'
];

const TITLE_PATTERNS = [
  /\b(ceo|cto|cfo|coo|chief|president|vp|director|founder|partner|principal)\b/i
];

function preClassifyEntity(entity) {
  const nameLower = entity.name.toLowerCase().trim();
  
  // Check for known VCs
  if (KNOWN_VCS.some(vc => nameLower.includes(vc))) {
    return { entity_type: 'INVESTOR', confidence: 0.95, reasoning: 'Known VC firm' };
  }
  
  // Check for places
  if (KNOWN_PLACES.some(place => nameLower === place || nameLower.includes(place + ' '))) {
    return { entity_type: 'PLACE', confidence: 0.95, reasoning: 'Geographic entity' };
  }
  
  // Check for generic terms
  if (GENERIC_TERMS.some(term => nameLower === term || nameLower === term + 's')) {
    return { entity_type: 'GENERIC_TERM', confidence: 0.9, reasoning: 'Generic industry term' };
  }
  
  // Check for title-bearing names (likely FOUNDER/EXECUTIVE)
  if (TITLE_PATTERNS.some(p => p.test(entity.name))) {
    return { entity_type: 'EXECUTIVE', confidence: 0.8, reasoning: 'Has executive title' };
  }
  
  // Check contexts for role patterns
  const contexts = entity.contexts || [];
  const investorRoleCount = contexts.filter(c => c.role === 'investor' || c.role === 'lead').length;
  const subjectRoleCount = contexts.filter(c => c.role === 'subject' || c.role === 'startup').length;
  
  // If appears as investor in most contexts, likely INVESTOR
  if (investorRoleCount > contexts.length * 0.6 && contexts.length >= 3) {
    return { entity_type: 'INVESTOR', confidence: 0.85, reasoning: 'Appears as investor in most contexts' };
  }
  
  // If appears as subject/startup in most funding contexts, likely STARTUP
  if (subjectRoleCount > contexts.length * 0.6 && contexts.length >= 3) {
    const hasFundingContext = contexts.some(c => c.eventType === 'FUNDING' || c.title?.toLowerCase().includes('raise'));
    if (hasFundingContext) {
      return { entity_type: 'STARTUP', confidence: 0.8, reasoning: 'Appears as subject in funding news' };
    }
  }
  
  // Could not pre-classify with high confidence
  return null;
}

/**
 * Step 1: Collect entity patterns from recent RSS data
 */
async function collectEntityPatterns() {
  console.log('📊 Collecting entity patterns from RSS data...\n');
  
  // Get recent events
  const { data: events } = await supabase
    .from('startup_events')
    .select('entities, source_title, event_type, frame_type, extraction_meta')
    .order('created_at', { ascending: false })
    .limit(500);
  
  if (!events?.length) {
    console.log('⚠️  No events found');
    return null;
  }
  
  // Count entity occurrences
  const entityFrequency = new Map();
  const entityContexts = new Map();
  
  events.forEach(event => {
    event.entities?.forEach(entity => {
      const name = entity.name;
      
      // Track frequency
      entityFrequency.set(name, (entityFrequency.get(name) || 0) + 1);
      
      // Track contexts
      if (!entityContexts.has(name)) {
        entityContexts.set(name, []);
      }
      entityContexts.get(name).push({
        title: event.source_title,
        eventType: event.event_type,
        frameType: event.frame_type,
        role: entity.role,
        graphSafe: event.extraction_meta?.graph_safe
      });
    });
  });
  
  // Filter to entities that appear multiple times
  const frequentEntities = Array.from(entityFrequency.entries())
    .filter(([name, count]) => count >= CONFIG.MIN_OCCURRENCES)
    .map(([name, count]) => ({
      name,
      count,
      contexts: entityContexts.get(name)
    }))
    .sort((a, b) => b.count - a.count);
  
  console.log(`Found ${frequentEntities.length} frequent entities (≥${CONFIG.MIN_OCCURRENCES} occurrences)\n`);
  
  return frequentEntities;
}

/**
 * Step 2: Check which entities are already in ontology
 */
async function filterUnclassified(entities) {
  console.log('🔍 Filtering entities not yet in ontology...\n');
  
  const unclassified = [];
  
  for (const entity of entities) {
    const { data: existing } = await supabase
      .from('entity_ontologies')
      .select('entity_name, entity_type')
      .ilike('entity_name', entity.name)
      .single();
    
    if (!existing) {
      unclassified.push(entity);
    }
  }
  
  console.log(`${unclassified.length} entities need classification\n`);
  
  return unclassified;
}

/**
 * Step 3: Classify entity with OpenAI (with retry logic & circuit breaker)
 */
async function classifyWithParser(entity) {
  // Check circuit breaker first
  if (!circuitBreaker.canProceed()) {
    console.log(`   ⏸️  Circuit breaker open, skipping "${entity.name}"`);
    return null;
  }

  const contextsText = entity.contexts
    .slice(0, 5) // Use first 5 contexts
    .map(c => `- "${c.title}" (${c.eventType}, ${c.role})`)
    .join('\n');
  
  const prompt = `Classify this entity that appears in startup/tech news RSS feeds:

Entity: "${entity.name}"
Appears ${entity.count} times

Sample contexts:
${contextsText}

Classify as ONE of:
- STARTUP (a specific company being built/funded)
- INVESTOR (VC firm, angel, fund deploying capital)
- FOUNDER (person starting companies)
- EXECUTIVE (person in company role)
- PLACE (geographic entity: country, city, region)
- GENERIC_TERM (category/group: "Researchers", "Big VCs", "Indian Startups")
- AMBIGUOUS (needs more context to disambiguate)

Return ONLY valid JSON:
{
  "entity_type": "STARTUP|INVESTOR|FOUNDER|EXECUTIVE|PLACE|GENERIC_TERM|AMBIGUOUS",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      circuitBreaker.recordSuccess();
      return result;
      
    } catch (error) {
      const isRetryable = error.status === 429 || error.status === 500 || 
                          error.status === 502 || error.status === 503 ||
                          error.message?.includes('fetch failed') ||
                          error.message?.includes('Connection error');
      
      if (isRetryable && attempt < CONFIG.MAX_RETRIES - 1) {
        const delay = getBackoffDelay(attempt);
        console.log(`   ⏳ Retry ${attempt + 1}/${CONFIG.MAX_RETRIES} for "${entity.name}" in ${(delay/1000).toFixed(1)}s (${error.message})`);
        await sleep(delay);
        continue;
      }
      
      // Non-retryable or max retries reached
      circuitBreaker.recordFailure();
      console.error(`❌ Classification failed for "${entity.name}": ${error.message}`);
      return null;
    }
  }
  
  return null;
}

/**
 * Step 4: Classify batch of entities (with pre-classification to save API calls!)
 */
async function classifyBatch(entities) {
  console.log(`🤖 Classifying ${entities.length} entities...\n`);
  
  const classifications = [];
  let patternClassified = 0;
  let apiClassified = 0;
  
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    
    console.log(`${i + 1}/${entities.length}: "${entity.name}" (${entity.count} occurrences)`);
    
    // TRY PATTERN-BASED CLASSIFICATION FIRST (saves API calls!)
    const preClassification = preClassifyEntity(entity);
    
    let classification;
    if (preClassification && preClassification.confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
      classification = preClassification;
      patternClassified++;
      console.log(`   ⚡ PATTERN: ${classification.entity_type} (${(classification.confidence * 100).toFixed(0)}%) - ${classification.reasoning}`);
    } else {
      // Fall back to OpenAI for complex cases
      classification = await classifyWithParser(entity);
      if (classification) {
        apiClassified++;
        console.log(`   🤖 API: ${classification.entity_type} (${(classification.confidence * 100).toFixed(0)}%)`);
      }
    }
    
    if (classification && classification.confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
      console.log(`   ✓ ${classification.entity_type} (${(classification.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`   ${classification.reasoning}\n`);
      
      classifications.push({
        entity_name: entity.name,
        entity_type: classification.entity_type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        occurrences: entity.count
      });
    } else {
      console.log(`   ⚠️  Low confidence or failed\n`);
    }
    
    // Rate limiting - use base delay with jitter (only if we used API)
    if (!preClassification || preClassification.confidence < CONFIG.CONFIDENCE_THRESHOLD) {
      await sleep(CONFIG.BASE_DELAY_MS * (0.75 + Math.random() * 0.5));
    }
    
    // Check circuit breaker between entities
    if (!circuitBreaker.canProceed()) {
      console.log(`\n⏸️  Circuit breaker open - stopping batch early`);
      break;
    }
  }
  
  // Summary
  console.log(`\n📊 Classification Summary:`);
  console.log(`   ⚡ Pattern-based: ${patternClassified} entities (no API cost)`);
  console.log(`   🤖 OpenAI API:    ${apiClassified} entities`);
  console.log(`   💰 API calls saved: ${Math.round((patternClassified / (patternClassified + apiClassified || 1)) * 100)}%\n`);
  
  return classifications;
}

/**
 * Step 5a: Auto-apply high-confidence classifications
 */
async function autoApplyClassifications(classifications) {
  console.log('🤖 Auto-applying high-confidence classifications...\n');
  
  const autoApplied = [];
  const needsReview = [];

  for (const classification of classifications) {
    if (classification.confidence >= CONFIG.AUTO_APPLY_THRESHOLD) {
      // Auto-apply: insert directly into entity_ontologies
      const { data, error } = await supabase
        .from('entity_ontologies')
        .insert({
          entity_name: classification.entity_name,
          entity_type: classification.entity_type,
          confidence: classification.confidence,
          source: 'ML_INFERENCE',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Duplicate - already exists, skip
          console.log(`   ⏭️  Skipped (duplicate): ${classification.entity_name}`);
        } else {
          console.error(`   ❌ Error applying ${classification.entity_name}:`, error.message);
        }
      } else {
        autoApplied.push(classification);
        console.log(`   ✅ ${classification.entity_name} → ${classification.entity_type} (${Math.round(classification.confidence * 100)}%)`);
      }
    } else {
      // Confidence too low - needs human review
      needsReview.push(classification);
    }
  }

  console.log(`\n   Auto-applied: ${autoApplied.length}`);
  console.log(`   Needs review: ${needsReview.length}\n`);

  return { autoApplied, needsReview };
}

/**
 * Step 5b: Save suggestions (audit trail)
 */
async function saveSuggestions(classifications, autoApplied) {
  console.log('� Saving audit trail to ai_logs...\n');
  
  const timestamp = new Date().toISOString();
  
  for (const classification of classifications) {
    const wasAutoApplied = autoApplied.some(a => a.entity_name === classification.entity_name);
    
    await supabase.from('ai_logs').insert({
      type: 'ontology_suggestion',
      action: 'ml_classification',
      status: wasAutoApplied ? 'auto_applied' : 'pending_review',
      output: {
        entity_name: classification.entity_name,
        suggested_type: classification.entity_type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        occurrences: classification.occurrences,
        auto_applied: wasAutoApplied,
        timestamp
      }
    });
  }
  
  console.log(`✅ Logged ${classifications.length} classifications\n`);
  
  return classifications;
}

/**
 * Step 6: Generate audit report
 */
function generateAuditReport(autoApplied, needsReview) {
  console.log('📊 Generating audit report...\n');
  
  const report = `# ML Ontology Learning - Audit Report
# Generated: ${new Date().toISOString()}

## ✅ Auto-Applied (Confidence ≥ ${CONFIG.AUTO_APPLY_THRESHOLD * 100}%)
${autoApplied.length > 0 ? autoApplied.map(c => 
  `- ${c.entity_name} → ${c.entity_type} (${Math.round(c.confidence * 100)}%): ${c.reasoning}`
).join('\n') : '(None this run)'}

## 🔍 Needs Review (Confidence < ${CONFIG.AUTO_APPLY_THRESHOLD * 100}%)
${needsReview.length > 0 ? needsReview.map(c => 
  `- ${c.entity_name} → ${c.entity_type} (${Math.round(c.confidence * 100)}%): ${c.reasoning}`
).join('\n') : '(None this run)'}

## 📈 Summary
- Total classifications: ${autoApplied.length + needsReview.length}
- Auto-applied: ${autoApplied.length}
- Needs manual review: ${needsReview.length}
- Success rate: ${autoApplied.length > 0 ? Math.round((autoApplied.length / (autoApplied.length + needsReview.length)) * 100) : 0}%
`;

  const fs = require('fs');
  const filename = `logs/ml-ontology-audit-${Date.now()}.txt`;
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
  }
  
  fs.writeFileSync(filename, report);
  
  console.log(`✅ Audit report: ${filename}\n`);
  
  return filename;
}

/**
 * Main workflow
 */
async function runOntologyLearning() {
  console.log('🧠 ML ONTOLOGY LEARNING AGENT (AUTOMATED)\n');
  console.log('═'.repeat(70) + '\n');
  
  try {
    // Check circuit breaker before starting
    if (!circuitBreaker.canProceed()) {
      const waitTime = CONFIG.CIRCUIT_BREAKER_RESET_MS - (Date.now() - circuitBreaker.lastFailure);
      console.log(`⏸️  Circuit breaker open. Waiting ${Math.round(waitTime / 1000)}s before retry...`);
      await sleep(Math.max(waitTime, 60000)); // Wait at least 1 minute
      return; // Let the cron restart handle it
    }
    
    // Step 1: Collect patterns
    const entityPatterns = await collectEntityPatterns();
    if (!entityPatterns) return;
    
    // Step 2: Filter to unclassified
    const unclassified = await filterUnclassified(entityPatterns.slice(0, CONFIG.BATCH_SIZE));
    if (!unclassified.length) {
      console.log('✅ All frequent entities already classified!\n');
      return;
    }
    
    // Step 3-4: Classify with ML
    const classifications = await classifyBatch(unclassified);
    
    if (!classifications.length) {
      console.log('⚠️  No confident classifications made\n');
      return;
    }
    
    // Step 5a: Auto-apply high-confidence
    const { autoApplied, needsReview } = await autoApplyClassifications(classifications);
    
    // Step 5b: Save audit trail
    await saveSuggestions(classifications, autoApplied);
    
    // Step 6: Generate audit report
    const reportFile = generateAuditReport(autoApplied, needsReview);
    
    console.log('═'.repeat(70) + '\n');
    console.log('📊 SUMMARY\n');
    console.log(`Analyzed: ${entityPatterns.length} frequent entities`);
    console.log(`Classified: ${classifications.length} new entities`);
    console.log(`Auto-applied: ${autoApplied.length} (≥${CONFIG.AUTO_APPLY_THRESHOLD * 100}% confidence)`);
    console.log(`Needs review: ${needsReview.length} (<${CONFIG.AUTO_APPLY_THRESHOLD * 100}% confidence)\n`);
    
    if (autoApplied.length > 0) {
      console.log('✅ NEW CLASSIFICATIONS:\n');
      autoApplied.forEach(c => {
        console.log(`   • ${c.entity_name} → ${c.entity_type} (${Math.round(c.confidence * 100)}%)`);
      });
      console.log('');
    }
    
    console.log('🔄 Parser will automatically use new ontologies in next RSS batch\n');
    
    if (needsReview.length > 0) {
      console.log('⚠️  LOW-CONFIDENCE CLASSIFICATIONS:\n');
      needsReview.forEach(c => {
        console.log(`   • ${c.entity_name} → ${c.entity_type} (${Math.round(c.confidence * 100)}%)`);
      });
      console.log(`\n   Review in ai_logs table WHERE status='pending_review'\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    
    // Record failure for circuit breaker
    circuitBreaker.recordFailure();
    
    // If circuit breaker is open, sleep instead of crashing
    if (circuitBreaker.isOpen) {
      console.log(`⏸️  Circuit breaker triggered. Sleeping for ${CONFIG.CIRCUIT_BREAKER_RESET_MS / 1000}s to prevent restart loop...`);
      await sleep(CONFIG.CIRCUIT_BREAKER_RESET_MS);
    }
  }
}

// Run if called directly
if (require.main === module) {
  runOntologyLearning();
}

module.exports = { runOntologyLearning };
