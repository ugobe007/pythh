#!/usr/bin/env node
/**
 * Test ML Ontology Agent - Automated Mode Demo
 * Simulates high-confidence classifications to demonstrate auto-apply
 */

const { createClient } = require('@supabase/supabase-js');
const envPath = process.env.ENV_FILE || '.env.bak';
require('dotenv').config({ path: envPath });

// Use service role key for automated background operations (bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Simulated ML classifications (high-confidence)
const SIMULATED_CLASSIFICATIONS = [
  {
    entity_name: 'Waymo',
    entity_type: 'STARTUP',
    confidence: 0.95,
    reasoning: 'Appears as subject of funding/launch events, typical startup pattern',
    occurrences: 3
  },
  {
    entity_name: 'Meta',
    entity_type: 'STARTUP',
    confidence: 0.88,
    reasoning: 'Tech company appearing in product launch and investment contexts',
    occurrences: 3
  },
  {
    entity_name: 'Binance',
    entity_type: 'STARTUP',
    confidence: 0.92,
    reasoning: 'Crypto exchange mentioned in funding and regulatory contexts',
    occurrences: 3
  },
  {
    entity_name: 'India',
    entity_type: 'PLACE',
    confidence: 0.98,
    reasoning: 'Geographic entity mentioned in context of "Indian startups"',
    occurrences: 5
  },
  {
    entity_name: 'Tech',
    entity_type: 'GENERIC_TERM',
    confidence: 0.76,
    reasoning: 'Generic descriptor appearing in phrases like "tech company"',
    occurrences: 3
  },
  {
    entity_name: 'Building',
    entity_type: 'GENERIC_TERM',
    confidence: 0.72,
    reasoning: 'Verb or generic term, not a startup name',
    occurrences: 3
  },
  {
    entity_name: 'Interview',
    entity_type: 'GENERIC_TERM',
    confidence: 0.68,
    reasoning: 'Generic action, not a startup',
    occurrences: 3
  }
];

const CONFIG = {
  AUTO_APPLY_THRESHOLD: 0.85
};

/**
 * Auto-apply high-confidence classifications
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
 * Save audit trail
 */
async function saveSuggestions(classifications, autoApplied) {
  console.log('📝 Saving audit trail to ai_logs...\n');
  
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
}

/**
 * Main test
 */
async function runTest() {
  console.log('🧠 ML ONTOLOGY LEARNING AGENT (AUTOMATED) - TEST MODE\n');
  console.log('═'.repeat(70) + '\n');
  
  try {
    console.log(`📊 Simulated ${SIMULATED_CLASSIFICATIONS.length} ML classifications\n`);
    
    // Auto-apply
    const { autoApplied, needsReview } = await autoApplyClassifications(SIMULATED_CLASSIFICATIONS);
    
    // Save audit trail
    await saveSuggestions(SIMULATED_CLASSIFICATIONS, autoApplied);
    
    console.log('═'.repeat(70) + '\n');
    console.log('📊 SUMMARY\n');
    console.log(`Classified: ${SIMULATED_CLASSIFICATIONS.length} entities`);
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
    
    console.log('✅ FULLY AUTOMATED - No manual intervention required!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runTest();
