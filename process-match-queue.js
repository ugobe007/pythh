#!/usr/bin/env node

/**
 * MATCH QUEUE PROCESSOR
 * 
 * This script processes the match_generation_queue table created by the database trigger.
 * It picks items from the queue and generates matches for each startup.
 * 
 * Usage:
 *   node process-match-queue.js              # Process entire queue
 *   node process-match-queue.js --limit 10   # Process max 10 items
 *   node process-match-queue.js --once       # Process one item and exit
 * 
 * PM2 Setup:
 *   Add to ecosystem.config.js:
 *   {
 *     name: 'match-queue-processor',
 *     script: 'process-match-queue.js',
 *     cron_restart: 'star-slash-5 star star star star',  // Every 5 minutes
 *     autorestart: false
 *   }
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Parse CLI args
const args = process.argv.slice(2);
const limit = args.includes('--limit') 
  ? parseInt(args[args.indexOf('--limit') + 1]) 
  : 50;
const once = args.includes('--once');

/**
 * Generate matches for a single startup
 */
async function generateMatchesForStartup(startupId) {
  console.log(`  Generating matches for startup ${startupId}...`);
  
  // Import the matching logic (you'll need to extract this from match-regenerator.js)
  // For now, we'll use a simple query approach
  
  try {
    // Get startup data
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      throw new Error(`Startup not found: ${startupError?.message}`);
    }
    
    // Get all active investors
    const { data: investors, error: investorsError } = await supabase
      .from('investors')
      .select('*')
      .eq('status', 'active');
    
    if (investorsError) {
      throw new Error(`Failed to load investors: ${investorsError.message}`);
    }
    
    console.log(`  Found ${investors.length} investors to match against`);
    
    // Generate matches (simplified scoring)
    const matches = [];
    for (const investor of investors) {
      const score = calculateMatchScore(startup, investor);
      
      if (score >= 20) { // MIN_MATCH_SCORE
        matches.push({
          startup_id: startupId,
          investor_id: investor.id,
          match_score: score,
          reasoning: generateReasoning(startup, investor, score),
          status: 'suggested',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    console.log(`  Generated ${matches.length} matches (score >= 20)`);
    
    if (matches.length > 0) {
      // Delete existing matches
      await supabase
        .from('startup_investor_matches')
        .delete()
        .eq('startup_id', startupId);
      
      // Insert new matches in batches
      const batchSize = 100;
      for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('startup_investor_matches')
          .insert(batch);
        
        if (insertError) {
          console.error(`  ⚠️ Batch insert error:`, insertError.message);
        }
      }
      
      console.log(`  ✅ Inserted ${matches.length} matches`);
    }
    
    return { success: true, matchCount: matches.length };
    
  } catch (err) {
    console.error(`  ❌ Error:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Simple match scoring (placeholder - use your actual GOD algorithm)
 */
function calculateMatchScore(startup, investor) {
  let score = startup.total_god_score || 50; // Base score from GOD score
  
  // Sector alignment
  const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  const investorSectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  const sectorOverlap = startupSectors.filter(s => investorSectors.includes(s)).length;
  
  if (sectorOverlap > 0) score += 10 * sectorOverlap;
  
  // Stage alignment (simplified)
  const startupStage = startup.stage || 'seed';
  const investorStages = Array.isArray(investor.stage) ? investor.stage : [investor.stage];
  
  if (investorStages.includes(startupStage)) score += 15;
  
  // Cap at 100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Generate reasoning array
 */
function generateReasoning(startup, investor, score) {
  const reasons = [];
  
  if (score >= 70) reasons.push('Strong overall alignment');
  if (startup.total_god_score >= 70) reasons.push('High GOD score');
  
  const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  const investorSectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  const overlap = startupSectors.filter(s => investorSectors.includes(s));
  
  if (overlap.length > 0) {
    reasons.push(`Sector match: ${overlap.join(', ')}`);
  }
  
  return reasons;
}

/**
 * Process the queue
 */
async function processQueue() {
  console.log('🚀 Match Queue Processor Starting...\n');
  
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  while (processed < limit) {
    // Get next item from queue
    const { data: queueItems, error: queueError } = await supabase
      .rpc('get_next_from_queue');
    
    if (queueError) {
      console.error('❌ Failed to get next queue item:', queueError.message);
      break;
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('✅ Queue is empty');
      break;
    }
    
    const item = queueItems[0];
    console.log(`\n[${processed + 1}/${limit}] Processing queue item ${item.id}`);
    console.log(`  Startup: ${item.startup_id} (priority: ${item.priority}, attempt: ${item.attempts})`);
    
    // Generate matches
    const result = await generateMatchesForStartup(item.startup_id);
    
    // Mark as completed or failed
    await supabase.rpc('complete_queue_item', {
      p_queue_id: item.id,
      p_success: result.success,
      p_error: result.error || null
    });
    
    if (result.success) {
      succeeded++;
      console.log(`  ✅ Completed (${result.matchCount} matches)`);
    } else {
      failed++;
      console.log(`  ❌ Failed: ${result.error}`);
    }
    
    processed++;
    
    if (once) break;
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Processed: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
  
  // Show queue status
  const { data: status } = await supabase
    .from('queue_status')
    .select('*');
  
  if (status && status.length > 0) {
    console.log('\n📋 Queue Status:');
    status.forEach(s => {
      console.log(`  ${s.status}: ${s.count} items (oldest: ${s.oldest ? new Date(s.oldest).toLocaleString() : 'N/A'})`);
    });
  }
}

// Run
processQueue()
  .then(() => {
    console.log('\n✅ Queue processing complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
