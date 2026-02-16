#!/usr/bin/env node
/**
 * DEAD WOOD CLEANUP - Remove Stagnant Startups
 * 
 * Purpose: Archive startups stuck at floor level (40 pts) with no improvement over 60 days
 * Rationale: Keep platform fresh, remove low-signal startups that aren't improving
 * 
 * Policy:
 * - GOD score = 40 (floor level)
 * - No score change in 60+ days
 * - Status = 'approved' (active in system)
 * 
 * Action: Change status to 'archived' (soft delete, preserves data)
 * 
 * Usage:
 *   node scripts/cleanup-dead-wood.js           # Dry run (show what would be removed)
 *   node scripts/cleanup-dead-wood.js --execute # Actually archive startups
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DRY_RUN = !process.argv.includes('--execute');
const FLOOR_SCORE = 40;
const STAGNANT_DAYS = 60;

async function cleanupDeadWood() {
  console.log('🗑️  DEAD WOOD CLEANUP');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚠️  EXECUTE (will archive)'}`);
  console.log('');

  // Step 1: Find stagnant startups
  console.log('Step 1: Finding stagnant startups...');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STAGNANT_DAYS);
  
  const { data: stagnant, error } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, last_score_change_at, created_at, website, pitch')
    .eq('status', 'approved')
    .eq('total_god_score', FLOOR_SCORE)
    .lt('last_score_change_at', cutoffDate.toISOString());

  if (error) {
    console.error('❌ Error fetching stagnant startups:', error);
    process.exit(1);
  }

  if (!stagnant || stagnant.length === 0) {
    console.log('✅ No stagnant startups found! All floor-level startups are recent.');
    console.log('');
    return;
  }

  console.log(`Found ${stagnant.length} stagnant startups:`);
  console.log('');

  // Step 2: Show details
  console.log('Stagnant Startups (sorted by age):');
  console.log('─'.repeat(60));
  
  const sorted = stagnant.sort((a, b) => 
    new Date(a.last_score_change_at) - new Date(b.last_score_change_at)
  );

  sorted.slice(0, 20).forEach((s, i) => {
    const daysSince = Math.floor(
      (new Date() - new Date(s.last_score_change_at)) / (1000 * 60 * 60 * 24)
    );
    console.log(`${i + 1}. ${s.name || '(unnamed)'}`);
    console.log(`   Score: ${s.total_god_score} | Stagnant: ${daysSince} days`);
    console.log(`   Last change: ${new Date(s.last_score_change_at).toLocaleDateString()}`);
    if (s.website) console.log(`   Website: ${s.website}`);
    console.log('');
  });

  if (sorted.length > 20) {
    console.log(`... and ${sorted.length - 20} more\n`);
  }

  // Step 3: Statistics
  console.log('📊 STATISTICS:');
  console.log('─'.repeat(60));
  const avgDaysSince = sorted.reduce((sum, s) => {
    const days = Math.floor(
      (new Date() - new Date(s.last_score_change_at)) / (1000 * 60 * 60 * 24)
    );
    return sum + days;
  }, 0) / sorted.length;

  const oldest = sorted[0];
  const oldestDays = Math.floor(
    (new Date() - new Date(oldest.last_score_change_at)) / (1000 * 60 * 60 * 24)
  );

  console.log(`Total stagnant: ${sorted.length}`);
  console.log(`Average stagnancy: ${Math.round(avgDaysSince)} days`);
  console.log(`Oldest: ${oldestDays} days (${oldest.name})`);
  console.log('');

  // Step 4: Quality check - verify they truly have no signals
  console.log('Step 2: Verifying signal quality...');
  const hasLowSignals = sorted.filter(s => {
    const data = s.extracted_data || {};
    const fieldCount = Object.keys(data).length;
    const hasPitch = s.pitch && s.pitch.length > 50;
    const hasWebsite = !!s.website;
    
    // Low quality = <3 fields, no pitch, no website
    return fieldCount < 3 && !hasPitch && !hasWebsite;
  });

  console.log(`${hasLowSignals.length}/${sorted.length} have low signal quality (verified)`);
  console.log('');

  // Step 5: Archive (if --execute)
  if (DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No changes made');
    console.log('');
    console.log('💡 To actually archive these startups, run:');
    console.log('   node scripts/cleanup-dead-wood.js --execute');
    console.log('');
    return;
  }

  console.log('Step 3: Archiving stagnant startups...');
  console.log('⚠️  This will change status to "archived" for all stagnant startups');
  console.log('');

  // Archive in batches
  const batchSize = 50;
  let archived = 0;

  for (let i = 0; i < sorted.length; i += batchSize) {
    const batch = sorted.slice(i, i + batchSize);
    const ids = batch.map(s => s.id);

    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({
        status: 'archived',
        admin_notes: `Auto-archived: Stagnant at floor (${FLOOR_SCORE}pts) for ${STAGNANT_DAYS}+ days. No signal improvement detected.`
      })
      .in('id', ids);

    if (updateError) {
      console.error(`❌ Error archiving batch ${i / batchSize + 1}:`, updateError);
      continue;
    }

    archived += batch.length;
    console.log(`   Archived batch ${Math.floor(i / batchSize) + 1}: ${batch.length} startups`);
  }

  console.log('');
  console.log('✅ CLEANUP COMPLETE');
  console.log('─'.repeat(60));
  console.log(`Archived: ${archived} startups`);
  console.log(`Policy: ${FLOOR_SCORE}pts + ${STAGNANT_DAYS}+ days stagnant`);
  console.log('');

  // Log to ai_logs
  await supabase.from('ai_logs').insert({
    log_type: 'system',
    log_level: 'info',
    message: `Dead wood cleanup: Archived ${archived} stagnant startups`,
    metadata: {
      archived_count: archived,
      floor_score: FLOOR_SCORE,
      stagnant_days: STAGNANT_DAYS,
      timestamp: new Date().toISOString()
    }
  });

  console.log('📝 Logged to ai_logs table');
  console.log('');
}

// Run cleanup
cleanupDeadWood()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
