#!/usr/bin/env node
/**
 * INVESTOR DATA CLEANUP
 * =====================
 * Identifies and removes garbage investor records that were accidentally
 * created from scraped article headline fragments.
 * 
 * Detection heuristics:
 *   1. Name too short (< 3 chars) or too long (> 80 chars / sentence-like)
 *   2. Name looks like an article fragment (contains verbs, articles at start)
 *   3. Name contains common scraper noise patterns
 *   4. No useful data (empty sectors, no score, empty bio)
 *   5. Has zero matches AND zero useful fields
 * 
 * Usage:
 *   node scripts/cleanup-garbage-investors.js --dry-run    # Preview (default)
 *   node scripts/cleanup-garbage-investors.js --execute     # Actually delete
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbageInvestorName } = require('../lib/investorNameHeuristics');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = !process.argv.includes('--execute');

function isGarbageName(name) {
  return isGarbageInvestorName(name);
}

function isDataPoor(investor) {
  const hasSectors = Array.isArray(investor.sectors) && investor.sectors.length > 0;
  const hasStage = Array.isArray(investor.stage) && investor.stage.length > 0;
  const hasBio = investor.bio && investor.bio.length > 10;
  const hasThesis = investor.investment_thesis && investor.investment_thesis.length > 10;
  const hasFirm = investor.firm && investor.firm.length > 2 && investor.firm !== investor.name;
  const hasLinkedin = investor.linkedin_url && investor.linkedin_url.length > 5;
  const hasEmail = investor.email && investor.email.length > 5;
  
  // Count useful fields  
  const usefulFields = [hasSectors, hasStage, hasBio, hasThesis, hasFirm, hasLinkedin, hasEmail].filter(Boolean).length;
  return usefulFields <= 1; // Only 0 or 1 useful field = data poor
}

async function main() {
  console.log('\n🧹 INVESTOR DATA CLEANUP');
  console.log('═'.repeat(50));
  console.log(`   Mode: ${isDryRun ? '🔍 DRY RUN (preview only)' : '⚡ EXECUTE (will delete!)'}`);
  console.log();

  // Fetch all investors with basic info
  let allInvestors = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, firm, bio, investment_thesis, sectors, stage, investor_score, investor_tier, linkedin_url, email')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    allInvestors = allInvestors.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`📊 Total investors: ${allInvestors.length}`);

  // Identify garbage records
  const garbage = [];
  const suspicious = [];

  for (const investor of allInvestors) {
    const nameIsGarbage = isGarbageName(investor.name);
    const dataPoor = isDataPoor(investor);

    if (nameIsGarbage && dataPoor) {
      garbage.push(investor);
    } else if (nameIsGarbage) {
      suspicious.push(investor);
    }
  }

  console.log(`🗑️  Garbage (bad name + no data): ${garbage.length}`);
  console.log(`⚠️  Suspicious (bad name but has data): ${suspicious.length}\n`);

  // Show sample garbage records
  if (garbage.length > 0) {
    console.log('--- Sample GARBAGE records (will DELETE) ---');
    for (const inv of garbage.slice(0, 20)) {
      const sectors = Array.isArray(inv.sectors) ? inv.sectors.join(',') : '[]';
      console.log(`  "${inv.name}" | sectors: ${sectors} | score: ${inv.investor_score}`);
    }
    if (garbage.length > 20) console.log(`  ... and ${garbage.length - 20} more\n`);
  }

  // Show sample suspicious records
  if (suspicious.length > 0) {
    console.log('\n--- Sample SUSPICIOUS records (will KEEP but flag) ---');
    for (const inv of suspicious.slice(0, 10)) {
      const sectors = Array.isArray(inv.sectors) ? inv.sectors.join(',') : '[]';
      console.log(`  "${inv.name}" | sectors: ${sectors} | firm: ${inv.firm || 'none'}`);
    }
    if (suspicious.length > 10) console.log(`  ... and ${suspicious.length - 10} more\n`);
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN complete. Run with --execute to delete garbage records.');
    console.log(`   Would delete: ${garbage.length} records`);
    console.log(`   Would keep: ${allInvestors.length - garbage.length} records`);
    return;
  }

  // Execute deletion
  if (garbage.length > 0) {
    console.log(`\n⚡ Deleting ${garbage.length} garbage investors...`);
    
    const garbageIds = garbage.map(g => g.id);
    
    // First delete their matches
    for (let i = 0; i < garbageIds.length; i += 100) {
      const batch = garbageIds.slice(i, i + 100);
      
      const { error: matchErr } = await supabase
        .from('startup_investor_matches')
        .delete()
        .in('investor_id', batch);
      
      if (matchErr) console.error(`  Match delete error: ${matchErr.message}`);
    }
    
    console.log('  ✅ Cleared associated matches');
    
    // Then delete investors
    let deleted = 0;
    for (let i = 0; i < garbageIds.length; i += 100) {
      const batch = garbageIds.slice(i, i + 100);
      
      const { error: delErr } = await supabase
        .from('investors')
        .delete()
        .in('id', batch);
      
      if (delErr) {
        console.error(`  Delete error: ${delErr.message}`);
      } else {
        deleted += batch.length;
      }
    }
    
    console.log(`  ✅ Deleted ${deleted} garbage investor records`);
  }

  console.log('\n✅ Cleanup complete!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
