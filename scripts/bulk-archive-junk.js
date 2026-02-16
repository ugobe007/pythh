/**
 * Bulk Archive Junk - Direct Approach
 * Archives all entries with: No website AND no traction AND no pitch
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function bulkArchive() {
  console.log('🔍 Finding junk entries...\n');
  
  // Fetch ALL approved startups with no website
  const { data: noWebsite } = await supabase
    .from('startup_uploads')
    .select('id, name, mrr, customer_count, pitch')
    .eq('status', 'approved')
    .is('website', null);
  
  console.log(`Found ${noWebsite?.length || 0} entries with no website`);
  
  let archived = 0;
  
  for (const st of noWebsite || []) {
    const hasTraction = (st.mrr && st.mrr > 0) || (st.customer_count && st.customer_count > 0);
    const hasPitch = st.pitch && st.pitch.length > 30;
    
    // Archive if no traction AND no pitch
    if (!hasTraction && !hasPitch) {
      const { error } = await supabase
        .from('startup_uploads')
        .update({ status: 'rejected' })
        .eq('id', st.id);
      
      if (!error) {
        archived++;
        if (archived % 50 === 0) console.log(`  Archived ${archived}...`);
      }
    }
  }
  
  console.log(`\n✅ Archived ${archived} junk entries`);
  
  // Check final stats
  const {count: approved} = await supabase
    .from('startup_uploads')
    .select('*', {count: 'exact'})
    .eq('status', 'approved')
    .limit(0);
  
  const {count: rejected} = await supabase
    .from('startup_uploads')
    .select('*', {count: 'exact'})
    .eq('status', 'rejected')
    .limit(0);
  
  console.log(`\n📊 FINAL STATUS:`);
  console.log(`  Approved: ${approved}`);
  console.log(`  Rejected: ${rejected}`);
}

bulkArchive().catch(console.error);
