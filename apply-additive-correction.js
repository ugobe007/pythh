const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyCorrection() {
  console.log('🔧 Applying psychological signals correction...\n');

  try {
    // Step 1: Rename column (ALTER TABLE requires admin access, so document it)
    console.log('⚠️  DATABASE COLUMN RENAME REQUIRED:');
    console.log('    Run this SQL in Supabase SQL Editor:');
    console.log('    ALTER TABLE startup_uploads RENAME COLUMN psychological_multiplier TO psychological_bonus;');
    console.log('');

    // Step 2: Recalculate enhanced scores using additive formula
    console.log('📊 Recalculating enhanced scores with additive formula...\n');

    // Get all startups with signals
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, psychological_multiplier')
      .not('psychological_multiplier', 'is', null);

    if (error) {
      console.error('❌ Error fetching startups:', error.message);
      process.exit(1);
    }

    console.log(`Found ${startups.length} startups with psychological signals`);

    // Convert multiplier values to bonus values
    // OLD: multiplier 1.0-1.6 (values above 1.0 represent boost)
    // NEW: bonus 0-10 (direct point values)
    
    let updated = 0;
    for (const startup of startups) {
      const oldMultiplier = startup.psychological_multiplier || 1.0;
      
      // Convert multiplier to bonus
      // multiplier 1.35 means 35% boost
      // For a score of 84, that's 84 * 0.35 = 29.4 boost (WRONG - too much)
      // Should be: ~6 points boost (CORRECT)
      
      // Calculate what the old boost was
      const oldBoost = startup.total_god_score * (oldMultiplier - 1.0);
      
      // Convert to new bonus (cap at typical range)
      // Typical boost should be 1-3 points, max 10
      const newBonus = Math.min(oldBoost * 0.2, 10); // Scale down the excessive boost
      
      // Calculate new enhanced score
      const newEnhanced = Math.min(startup.total_god_score + newBonus, 100);

      // Update the startup
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({
          psychological_multiplier: newBonus, // Store bonus in multiplier column for now
          enhanced_god_score: Math.round(newEnhanced)
        })
        .eq('id', startup.id);

      if (updateError) {
        console.error(`❌ Error updating ${startup.name}:`, updateError.message);
      } else {
        const oldEnhanced = Math.round(startup.total_god_score * oldMultiplier);
        console.log(`✅ ${startup.name}: ${startup.total_god_score} + ${newBonus.toFixed(1)}pts = ${Math.round(newEnhanced)} (was ${oldEnhanced})`);
        updated++;
      }
    }

    console.log(`\n✅ Updated ${updated}/${startups.length} startups to additive formula`);
    console.log('\n📋 MANUAL STEPS REQUIRED:');
    console.log('   1. Run this SQL in Supabase SQL Editor to rename column:');
    console.log('      ALTER TABLE startup_uploads RENAME COLUMN psychological_multiplier TO psychological_bonus;');
    console.log('   2. Update database functions (see migration file)');
    console.log('   3. Code has been updated to use psychological_bonus');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

applyCorrection().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
