// Emergency fix: Correct component scores from 0-100 scale to 0-20 scale
// This directly updates corrupted component scores without full recalculation
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixComponentScores() {
  console.log('🔧 EMERGENCY COMPONENT SCORE FIX');
  console.log('Converting corrupted 0-100 scale to correct 0-20 scale\n');

  // First, get the total count
  const { count: totalCount } = await supabase
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .or('team_score.gt.20,traction_score.gt.20,market_score.gt.20,product_score.gt.20,vision_score.gt.20');

  console.log(`Total startups with corrupted scores: ${totalCount}\n`);

  let fixed = 0;
  let errors = 0;
  let offset = 0;
  const batchSize = 1000;

  while (offset < totalCount) {
    console.log(`Processing batch ${Math.floor(offset/batchSize) + 1} (${offset}-${Math.min(offset + batchSize, totalCount)})...`);
    
    // Get batch of startups with corrupted component scores
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, team_score, traction_score, market_score, product_score, vision_score, total_god_score')
      .eq('status', 'approved')
      .or('team_score.gt.20,traction_score.gt.20,market_score.gt.20,product_score.gt.20,vision_score.gt.20')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching batch:', error);
      break;
    }

    if (startups.length === 0) break;

    for (const startup of startups) {
      // Apply the correct scaling: divide by 5 to convert from 0-100 to 0-20
      // Then cap at 20 max
      const fixedTeam = Math.min(Math.round(startup.team_score / 5), 20);
      const fixedTraction = Math.min(Math.round(startup.traction_score / 5), 20);
      const fixedMarket = Math.min(Math.round(startup.market_score / 5), 20);
      const fixedProduct = Math.min(Math.round(startup.product_score / 5), 20);
      const fixedVision = Math.min(Math.round(startup.vision_score / 5), 20);
      
      const newTotal = fixedTeam + fixedTraction + fixedMarket + fixedProduct + fixedVision;
      
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({
          team_score: fixedTeam,
          traction_score: fixedTraction,
          market_score: fixedMarket,
          product_score: fixedProduct,
          vision_score: fixedVision,
          total_god_score: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', startup.id);

      if (updateError) {
        console.error(`❌ ${startup.name}: ${updateError.message}`);
        errors++;
      } else {
        fixed++;
        if (fixed % 500 === 0) {
          console.log(`✅ Fixed ${fixed}/${totalCount} startups...`);
        }
      }
    }

    offset += batchSize;
  }

  console.log(`\n📊 RESULTS:`);
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`\n🎯 Component scores now 0-20 scale`);
}

fixComponentScores().catch(console.error);
