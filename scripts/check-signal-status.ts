/**
 * SIGNAL SYSTEM STATUS CHECK
 * Shows the complete workflow, what's active, and impact on GOD scores
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSignalStatus() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    SIGNAL SYSTEM STATUS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Check 1: Does startup_signals_state table exist?
  console.log('1️⃣  DATABASE TABLES CHECK\n');
  
  const { data: signalState, error: stateError } = await supabase
    .from('startup_signals_state')
    .select('*')
    .limit(5);
  
  if (stateError) {
    console.log('   startup_signals_state: ❌ NOT EXISTS or error');
    console.log('   Error:', stateError.message);
  } else {
    console.log('   startup_signals_state: ✅ EXISTS');
    console.log('   Records:', signalState?.length || 0);
  }

  // Check 2: Does signals_bonus column exist on startup_uploads?
  const { data: uploads, error: uploadError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, signals_bonus')
    .eq('status', 'approved')
    .limit(10);

  if (uploadError && uploadError.message.includes('signals_bonus')) {
    console.log('   startup_uploads.signals_bonus: ❌ COLUMN NOT EXISTS');
  } else if (uploads) {
    console.log('   startup_uploads.signals_bonus: ✅ COLUMN EXISTS');
    
    // Count how many have non-zero signals
    const withSignals = uploads.filter(u => u.signals_bonus && u.signals_bonus > 0);
    console.log(`   Records with signals_bonus > 0: ${withSignals.length}/${uploads.length}`);
  }

  // Check 3: Does god_score_explanations exist?
  const { data: explanations, error: expError } = await supabase
    .from('god_score_explanations')
    .select('startup_id, base_god_score, signals_bonus, total')
    .limit(5);

  if (expError) {
    console.log('   god_score_explanations: ❌ NOT EXISTS or error');
  } else {
    console.log('   god_score_explanations: ✅ EXISTS');
    console.log('   Records:', explanations?.length || 0);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    SIGNAL WORKFLOW');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('DESIGNED WORKFLOW (as documented):');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ 1. TRIGGER: New data arrives (scrape, upload, update)          │');
  console.log('│                              ↓                                  │');
  console.log('│ 2. CALCULATE: Signal dimensions (5 dimensions, 0-1 each)       │');
  console.log('│    • product_velocity (max 2.0 pts)                            │');
  console.log('│    • funding_acceleration (max 2.5 pts)                        │');
  console.log('│    • customer_adoption (max 2.0 pts)                           │');
  console.log('│    • market_momentum (max 1.5 pts)                             │');
  console.log('│    • competitive_dynamics (max 2.0 pts)                        │');
  console.log('│                              ↓                                  │');
  console.log('│ 3. CHECK: 50% change threshold                                 │');
  console.log('│    Compare new dimensions vs stored dimensions                 │');
  console.log('│    If ANY dimension changed ≥50% → apply signals               │');
  console.log('│    Otherwise → keep old signals (stability)                    │');
  console.log('│                              ↓                                  │');
  console.log('│ 4. COMPUTE: signals_bonus = Σ(dimension × max_points)          │');
  console.log('│    Range: 0-10 (typical 1-3, 7+ rare)                          │');
  console.log('│                              ↓                                  │');
  console.log('│ 5. STORE: Update startup_signals_state table                   │');
  console.log('│    Update startup_uploads.signals_bonus                        │');
  console.log('│                              ↓                                  │');
  console.log('│ 6. DISPLAY: final_score = GOD_base + signals_bonus             │');
  console.log('└─────────────────────────────────────────────────────────────────┘');

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    CURRENT STATUS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Check actual signal data
  const { data: allUploads } = await supabase
    .from('startup_uploads')
    .select('total_god_score, signals_bonus')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(1000);

  if (allUploads) {
    const withSignals = allUploads.filter(u => u.signals_bonus && u.signals_bonus > 0);
    const totalSignalsBonus = withSignals.reduce((sum, u) => sum + (u.signals_bonus || 0), 0);
    
    console.log('STARTUPS ANALYZED:');
    console.log(`  Total approved: ${allUploads.length}`);
    console.log(`  With signals_bonus > 0: ${withSignals.length} (${(withSignals.length/allUploads.length*100).toFixed(1)}%)`);
    
    if (withSignals.length > 0) {
      const avgBonus = totalSignalsBonus / withSignals.length;
      const bonuses = withSignals.map(u => u.signals_bonus);
      console.log(`  Average signals_bonus: ${avgBonus.toFixed(2)}`);
      console.log(`  Min signals_bonus: ${Math.min(...bonuses).toFixed(2)}`);
      console.log(`  Max signals_bonus: ${Math.max(...bonuses).toFixed(2)}`);
      
      // Distribution
      const b1 = bonuses.filter(b => b < 1).length;
      const b1_3 = bonuses.filter(b => b >= 1 && b < 3).length;
      const b3_5 = bonuses.filter(b => b >= 3 && b < 5).length;
      const b5_7 = bonuses.filter(b => b >= 5 && b < 7).length;
      const b7 = bonuses.filter(b => b >= 7).length;
      
      console.log('\n  SIGNAL BONUS DISTRIBUTION:');
      console.log(`    0-1 (minimal):  ${b1} (${(b1/bonuses.length*100).toFixed(1)}%)`);
      console.log(`    1-3 (typical):  ${b1_3} (${(b1_3/bonuses.length*100).toFixed(1)}%)`);
      console.log(`    3-5 (strong):   ${b3_5} (${(b3_5/bonuses.length*100).toFixed(1)}%)`);
      console.log(`    5-7 (hot):      ${b5_7} (${(b5_7/bonuses.length*100).toFixed(1)}%)`);
      console.log(`    7-10 (rare):    ${b7} (${(b7/bonuses.length*100).toFixed(1)}%)`);
    } else {
      console.log('\n  ⚠️  NO SIGNALS HAVE BEEN APPLIED YET');
      console.log('  The signals_bonus column exists but all values are 0 or null');
    }

    // Impact analysis
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('                    IMPACT ON GOD SCORES');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    if (withSignals.length > 0) {
      const avgGod = allUploads.reduce((s, u) => s + u.total_god_score, 0) / allUploads.length;
      const avgGodWithSignals = withSignals.reduce((s, u) => s + u.total_god_score, 0) / withSignals.length;
      const avgBonusApplied = totalSignalsBonus / withSignals.length;
      
      console.log('SCORE IMPACT:');
      console.log(`  Average GOD score (all): ${avgGod.toFixed(1)}`);
      console.log(`  Average GOD score (those with signals): ${avgGodWithSignals.toFixed(1)}`);
      console.log(`  Average signal bonus applied: +${avgBonusApplied.toFixed(2)}`);
      console.log(`  Effective final score: ${(avgGodWithSignals + avgBonusApplied).toFixed(1)}`);
    } else {
      console.log('SIGNALS NOT YET APPLIED - NO IMPACT ON SCORES');
      console.log('');
      console.log('To activate signals:');
      console.log('  1. Run migration: 20260130_signal_state_table.sql');
      console.log('  2. Run signal calculation batch job');
      console.log('  3. Or manually call applySignalsToGodScore() from signalApplicationService.ts');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    UPDATE FREQUENCY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('DESIGNED UPDATE TRIGGERS:');
  console.log('  • When startup data changes (scrape/upload/edit)');
  console.log('  • Only applies if signal dimensions change by ≥50%');
  console.log('  • This prevents score volatility from minor data changes');
  console.log('');
  console.log('CURRENT UPDATE STATUS:');
  
  if (signalState && signalState.length > 0) {
    // Check last update times
    const { data: recentUpdates } = await supabase
      .from('startup_signals_state')
      .select('updated_at, last_significant_change')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (recentUpdates && recentUpdates.length > 0) {
      console.log('  Last signal updates:');
      recentUpdates.forEach(u => {
        console.log(`    - ${new Date(u.updated_at).toISOString()}`);
      });
    }
  } else {
    console.log('  ❌ No signal state records exist - signals have never been calculated');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    IMPLEMENTATION STATUS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('✅ IMPLEMENTED:');
  console.log('  • Signal dimension definitions (5 dimensions, max 10 points)');
  console.log('  • 50% change threshold logic (signalApplicationService.ts)');
  console.log('  • Signal calculation functions (calculateProductVelocity, etc.)');
  console.log('  • Runtime invariants (signals_bonus capped at 10)');
  console.log('  • Database migration script ready');
  console.log('');
  console.log('❌ NOT YET ACTIVE:');
  console.log('  • startup_signals_state table may not be created');
  console.log('  • Batch job to calculate signals for all startups');
  console.log('  • Integration with scraper/enrichment pipeline');
  console.log('  • PM2 cron job for periodic signal recalculation');
}

checkSignalStatus();
