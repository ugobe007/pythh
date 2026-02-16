#!/usr/bin/env node
/**
 * Archive Junk Entries
 * ====================
 * Purpose: Move startups with no substantive data from 'approved' to 'rejected' status
 * 
 * Problem: RSS scrapers collected news snippets (e.g., "Jeff Bezos", "Nvidia's Huang")
 *          that passed the old permissive filter and are now scored startups
 * 
 * Solution: Apply stricter data quality criteria and archive (reject) entries that don't meet it
 * 
 * Criteria for KEEPING (must meet at least one):
 * - Real pitch (50+ chars)
 * - Launched with team (website + launched + team > 1)
 * - Has revenue (MRR > 0)
 * - Has customers (customer_count > 0)
 * - Rich extracted data (5+ fields)
 * 
 * Created: Feb 14, 2026
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function archiveJunkEntries() {
  console.log('\n🗑️  ARCHIVING JUNK ENTRIES (Feb 14, 2026)\n');
  console.log('Purpose: Remove scraped news snippets from approved startups');
  console.log('Action: Change status from "approved" → "rejected"\n');
  
  // Fetch ALL approved startups using pagination
  let allStartups = [];
  let page = 0;
  const pageSize = 1000;
  
  console.log('📥 Fetching startups from database...');
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, pitch, website, is_launched, team_size, mrr, customer_count, extracted_data, total_god_score')
      .eq('status', 'approved')
      .range(page * pageSize, ((page + 1) * pageSize) - 1);
    
    if (error) {
      console.error('❌ Error fetching startups:', error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    
    allStartups = allStartups.concat(data);
    console.log(`  Fetched page ${page + 1}: ${data.length} startups (total: ${allStartups.length})`);
    
    if (data.length < pageSize) break; // Last page
    page++;
  }
  
  console.log(`\n📊 Total approved startups: ${allStartups.length}\n`);
  
  // Apply strict filter to identify junk
  const junkEntries = [];
  const realStartups = [];
  
  for (const s of allStartups) {
    const dataFieldCount = s.extracted_data ? Object.keys(s.extracted_data).length : 0;
    const hasMinimumData = (
      (s.pitch && s.pitch.length > 50) ||                        // Real pitch
      (s.website && s.is_launched && s.team_size > 1) ||         // Launched with team
      s.mrr > 0 ||                                                // Has revenue
      s.customer_count > 0 ||                                     // Has customers
      dataFieldCount >= 5                                         // Rich data
    );
    
    if (hasMinimumData) {
      realStartups.push(s);
    } else {
      junkEntries.push(s);
    }
  }
  
  console.log(`✅ Real startups (keeping): ${realStartups.length}`);
  console.log(`🗑️  Junk entries (archiving): ${junkEntries.length}\n`);
  
  if (junkEntries.length === 0) {
    console.log('✨ No junk entries found. Database is clean!');
    return;
  }
  
  // Show samples
  console.log('📋 SAMPLE JUNK ENTRIES (first 10):');
  for (const entry of junkEntries.slice(0, 10)) {
    console.log(`   "${entry.name}" (Score: ${entry.total_god_score})`);
  }
  console.log('');
  
  // Archive junk entries in batches (Supabase has query size limits)
  const junkIds = junkEntries.map(e => e.id);
  
  console.log('🔄 Archiving junk entries in batches (changing status to "rejected")...\n');
  
  const batchSize = 100; // Reduced batch size to avoid query limits
  let totalArchived = 0;
  
  for (let i = 0; i < junkIds.length; i += batchSize) {
    const batch = junkIds.slice(i, i + batchSize);
    
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({ status: 'rejected' })
      .in('id', batch);
    
    if (updateError) {
      console.error('❌ Error archiving batch:', updateError);
      process.exit(1);
    }
    
    totalArchived += batch.length;
    console.log(`  Archived ${totalArchived}/${junkIds.length} entries...`);
  }
  
  console.log(`\n✅ Archived ${totalArchived} junk entries\n`);
  
  // Calculate expected impact on average
  const realAvg = realStartups.reduce((sum, s) => sum + s.total_god_score, 0) / realStartups.length;
  const junkAvg = junkEntries.reduce((sum, s) => sum + s.total_god_score, 0) / junkEntries.length;
  const overallAvg = allStartups.reduce((sum, s) => sum + s.total_god_score, 0) / allStartups.length;
  
  console.log('📊 IMPACT ON GOD SCORES:');
  console.log(`   Before: ${overallAvg.toFixed(1)}/100 (all ${allStartups.length} startups)`);
  console.log(`   After: ${realAvg.toFixed(1)}/100 (${realStartups.length} real startups)`);
  console.log(`   Junk average was: ${junkAvg.toFixed(1)}/100`);
  console.log(`   Improvement: +${(realAvg - overallAvg).toFixed(1)} points\n`);
  
  console.log('✅ Archive complete!');
  console.log('📍 Next step: Run recalculate-scores.ts to update remaining startups\n');
}

archiveJunkEntries().catch(console.error);
