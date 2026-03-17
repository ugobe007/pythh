#!/usr/bin/env node
/**
 * Batch Inference Enrichment
 * Runs inference-extractor on existing startups to populate missing data
 * NO AI APIs - pure pattern matching
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { extractInferenceData } = require('./lib/inference-extractor');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🧠 Running Inference Extraction on Existing Startups');
  console.log('═'.repeat(60));
  console.log('(NO AI APIs - pure pattern matching)\n');

  // Get startups that have description/tagline but low component scores
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, tagline, description, extracted_data, traction_score, product_score, vision_score, website')
    .or('traction_score.lt.10,product_score.lt.10,vision_score.lt.10')
    .not('tagline', 'is', null)
    .limit(200);

  if (error) {
    console.error('Error fetching startups:', error.message);
    process.exit(1);
  }

  console.log(`Found ${startups?.length || 0} startups needing enrichment\n`);

  let enriched = 0;
  let unchanged = 0;

  for (const startup of (startups || [])) {
    // Build text from available fields
    const text = [
      startup.tagline || '',
      startup.description || '',
      JSON.stringify(startup.extracted_data || {})
    ].join(' ');

    if (text.length < 20) {
      unchanged++;
      continue;
    }

    // Run inference extraction
    const inference = extractInferenceData(text, startup.website || '');

    // Check if we found anything useful
    const hasNewData =
      inference.execution_signals?.length > 0 ||
      inference.team_signals?.length > 0 ||
      inference.funding_amount ||
      inference.is_launched ||
      inference.has_customers ||
      inference.has_revenue;

    if (hasNewData) {
      // Merge with existing extracted_data
      const newExtractedData = {
        ...(startup.extracted_data || {}),
        ...inference,
        inference_enriched: true,
        inference_date: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({ extracted_data: newExtractedData })
        .eq('id', startup.id);

      if (!updateError) {
        const signals = [];
        if (inference.execution_signals?.length) signals.push(`exec:${inference.execution_signals.length}`);
        if (inference.team_signals?.length) signals.push(`team:${inference.team_signals.length}`);
        if (inference.funding_amount) signals.push(`$${(inference.funding_amount/1e6).toFixed(1)}M`);
        if (inference.is_launched) signals.push('launched');
        if (inference.has_customers) signals.push('customers');
        if (inference.has_revenue) signals.push('revenue');
        
        console.log(`  ✅ ${startup.name.substring(0, 30).padEnd(30)} [${signals.join(', ')}]`);
        enriched++;
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: ${enriched} enriched, ${unchanged} unchanged`);
  console.log('═'.repeat(60));
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
