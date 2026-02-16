#!/usr/bin/env node
/**  
 * EMERGENCY RESTORATION
 * =====================
 * Restoring all archived startups back to approved status
 * Reverting changes made on Feb 14, 2026
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function restoreArchivedStartups() {
  console.log('\n🚨 EMERGENCY RESTORATION - Feb 14, 2026');
  console.log('═══════════════════════════════════════════\n');
  console.log('Purpose: Restore startups archived by mistake');
  console.log('Action: Change status from "rejected" → "approved"\n');
  
  // Count rejected startups
  const { count: rejectedCount } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rejected');
  
  console.log(`📊 Found ${rejectedCount} rejected startups\n`);
  
  // Restore all rejected to approved
  console.log('🔄 Restoring all rejected startups to approved...\n');
  
  const { error, count } = await supabase
    .from('startup_uploads')
    .update({ status: 'approved' })
    .eq('status', 'rejected');
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log(`✅ Restored ${count || rejectedCount} startups to approved status\n`);
  
  // Check new counts
  const { count: approvedCount } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  
  console.log('📊 FINAL COUNTS:');
  console.log(`  Approved: ${approvedCount}`);
  console.log(`  Rejected: 0 (all restored)\n`);
  
  console.log('✅ Restoration complete!');
  console.log('📍 Next: Revert changes to recalculate-scores.ts');
  console.log('📍 Then: Run recalculation to restore proper distribution\n');
}

restoreArchivedStartups().catch(console.error);
