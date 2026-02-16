#!/usr/bin/env node
/**
 * Apply GOD Score Floor - Simplified Version
 * Manually creates the trigger function and applies it
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyFloor() {
  console.log('\n🔧 APPLYING GOD SCORE FLOOR (40 minimum)\n');
  console.log('═'.repeat(70));
  
  try {
    // Step 1: Backfill existing startups - raise scores below 40 to 40
    console.log('\n📊 Step 1: Backfilling existing startups...\n');
    
    // Get ALL approved startups with score < 40 (paginate to avoid 1000-row limit)
    const pageSize = 1000;
    let from = 0;
    const lowScorers = [];
    
    while (true) {
      const { data, error: fetchError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, enhanced_god_score')
        .eq('status', 'approved')
        .lt('total_god_score', 40)
        .range(from, from + pageSize - 1);
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!data || data.length === 0) break;
      lowScorers.push(...data);
      
      if (data.length < pageSize) break;
      from += pageSize;
    }
    
    console.log(`   Found ${lowScorers.length} approved startups with score < 40 (all will be raised to 40)\n`);
    
    const toUpdate = lowScorers;
    
    // Update in batches
    let updated = 0;
    for (const startup of toUpdate) {
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({
          total_god_score: 40,
          // Preserve any existing enhanced bonuses but enforce the 40 floor
          enhanced_god_score: startup.enhanced_god_score == null
            ? startup.enhanced_god_score
            : Math.max(40, startup.enhanced_god_score)
        })
        .eq('id', startup.id);
      
      if (!updateError) {
        updated++;
        if (updated % 10 === 0 || updated === toUpdate.length) {
          console.log(`   ✅ Updated ${updated}/${toUpdate.length} startups`);
        }
      }
    }
    
    console.log('\n═'.repeat(70));
    console.log('\n✅ Floor applied successfully!');
    console.log(`   ${updated} startups raised to minimum 40`);
    
    // Step 2: Check new average
    console.log('\n📊 Step 2: Checking new average...\n');
    
    const { data: allScores } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved');
    
    if (allScores && allScores.length > 0) {
      const avg = allScores.reduce((sum, s) => sum + s.total_god_score, 0) / allScores.length;
      const below40 = allScores.filter(s => s.total_god_score < 40).length;
      
      console.log('  📈 NEW STATISTICS:');
      console.log(`     Total startups: ${allScores.length}`);
      console.log(`     Average GOD Score: ${avg.toFixed(2)}/100`);
      console.log(`     Below 40: ${below40} (${(below40/allScores.length*100).toFixed(1)}%)`);
      console.log('');
      
      if (avg >= 50 && avg <= 62) {
        console.log('  ✅✅✅ TARGET ACHIEVED (50-62 range)!');
      } else if (avg >= 45 && avg < 50) {
        console.log('  🟡 Close to target (need to adjust floor to 42-45)');
      } else if (avg > 62) {
        console.log('  ⚠️  Above target (floor too high, reduce to 35-38)');
      } else {
        console.log('  ⚠️  Below target (increase floor or run full recalc)');
      }
    }
    
    console.log('\n═'.repeat(70));
    console.log('\n💡 NEXT STEPS:');
    console.log('   1. If avg is NOT in 50-62 range, adjust floor value');
    console.log('   2. Run: npx tsx scripts/recalculate-scores.ts (with new floor logic)');
    console.log('   3. This will skip junk data AND enforce 40 minimum\n');
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
  
  process.exit(0);
}

applyFloor();
