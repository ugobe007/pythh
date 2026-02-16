// Mass update all startups with signal flags to trigger psychological bonus calculation
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function massUpdateSignals() {
  console.log('🔄 MASS UPDATE: Triggering psychological bonus calculation\n');
  
  // Get all startups with signal flags
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, is_oversubscribed, has_followon, is_competitive, is_bridge_round, total_god_score, psychological_multiplier, enhanced_god_score')
    .eq('status', 'approved')
    .or('is_oversubscribed.eq.true,has_followon.eq.true,is_competitive.eq.true,is_bridge_round.eq.true');
  
  if (error) {
    console.error('Error fetching startups:', error);
    return;
  }
  
  console.log(`Found ${startups.length} startups with signal flags\n`);
  console.log('Triggering updates to recalculate psychological bonuses...\n');
  
  let updated = 0;
  let errors = 0;
  
  for (const startup of startups) {
    // Trigger by updating total_god_score to itself
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({ total_god_score: startup.total_god_score })
      .eq('id', startup.id);
    
    if (updateError) {
      console.error(`❌ ${startup.name}: ${updateError.message}`);
      errors++;
    } else {
      updated++;
      if (updated % 10 === 0) {
        console.log(`✅ Updated ${updated}/${startups.length}...`);
      }
    }
  }
  
  console.log(`\n📊 RESULTS:`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Errors: ${errors}`);
  
  console.log(`\n🔍 Verifying results...\n`);
  
  // Check how many now have psychological_multiplier > 0
  const { count: withBonus } = await supabase
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gt('psychological_multiplier', 0);
  
  console.log(`Startups with psychological bonus > 0: ${withBonus}`);
  console.log(`Expected (with flags): ${startups.length}`);
  console.log(`${withBonus >= startups.length ? '✅ All flagged startups have bonuses!' : '⚠️  Some startups still missing bonuses'}`);
}

massUpdateSignals().catch(console.error);
