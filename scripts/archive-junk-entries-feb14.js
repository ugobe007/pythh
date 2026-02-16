/**
 * Archive Junk Entries - Feb 14, 2026
 * 
 * Problem: RSS scrapers are treating news headlines as startup names
 * Example: "Nvidia's Huang" (news subject) vs "Cashew Research" (real startup)
 * 
 * Solution: Archive entries with no substantive data (no website, no traction, no pitch)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function archiveJunkEntries() {
  console.log('🔍 Scanning ALL approved startups for junk entries...\n');
  
  // Get total count first
  const { count: totalCount } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  
  console.log(`📊 Total approved startups: ${totalCount}\n`);
  
  let archived = 0;
  let kept = 0;
  const batchSize = 1000;
  
  // Process in batches
  for (let offset = 0; offset < totalCount; offset += batchSize) {
    console.log(`Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalCount/batchSize)}...`);
    
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, description, pitch, website, mrr, customer_count, team_size, is_launched, total_god_score')
      .eq('status', 'approved')
      .range(offset, offset + batchSize - 1);
  
  if (error) {
    console.error('Error fetching startups:', error);
    continue;
  }
  
  for (const st of startups) {
    // Check for substantive data
    const hasPitch = st.pitch && st.pitch.length > 30;
    const hasWebsite = !!st.website;
    const hasTraction = (st.mrr && st.mrr > 0) || (st.customer_count && st.customer_count > 0);
    
    // Archive if NO substantive data (likely news snippet or scraped junk)
    if (!hasWebsite && !hasTraction && !hasPitch) {
      // Archive this entry
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({
          status: 'rejected'
        })
        .eq('id', st.id);
      
      if (!updateError) {
        archived++;
      }
    } else {
      kept++;
    }
  }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 ARCHIVE SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total processed: ${totalCount}`);
  console.log(`✅ Real startups kept: ${kept}`);
  console.log(`❌ Junk entries archived: ${archived} (${(archived/totalCount*100).toFixed(1)}%)`);
  console.log('='.repeat(70));
  
  console.log('\n✅ Archive complete!');
  console.log('📝 Next step: Run score recalculation');
  console.log('   npx tsx scripts/recalculate-scores.ts\n');
}

archiveJunkEntries().catch(console.error);
