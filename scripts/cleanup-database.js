#!/usr/bin/env node

/**
 * Database Cleanup Script
 * 
 * Identifies and removes junk entries from startup_uploads and investors tables
 * that were created from scraped news articles and text fragments.
 * 
 * Usage:
 *   node scripts/cleanup-database.js --dry-run   # Preview what would be deleted
 *   node scripts/cleanup-database.js --execute   # Actually delete the junk
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Patterns that indicate junk data (news fragments, not real company names)
const JUNK_PATTERNS = {
  // Possessive/contractions (sentence fragments)
  possessives: ["I've", "he's", "she's", "it's", "they're", "we're", "you're", "'s ", " 's"],
  
  // News article patterns
  newsPatterns: [
    'by ', 'By ', ' CEO', 'founder of', 'founder, ', 'co-founder of'
  ],
  
  // Sentence fragments
  fragments: [
    'Over the last', 'In the past', 'According to', 'Sources say',
    'Reports suggest', 'It was announced', 'Approve ', 'approve '
  ],
  
  // Tech giants AS THE WHOLE NAME (not partial match)
  techGiantsExact: [
    'Nvidia', 'Intel', 'AMD', 'Oracle', 'Microsoft', 'Google', 'Amazon',
    'Apple', 'Meta', 'Facebook', 'Tesla', 'IBM', 'Salesforce'
  ],
  
  // Financial notation in names (article titles like "Company $42M")
  financial: /\$\d+|\€\d+|\£\d+/,
  
  // Action verbs AS SUFFIX (article headlines like "Company Announces" or "Company Raises")
  actionVerbSuffix: / (Announces|Launches|Raises|Secures|Closes|Unveils|Introduces|Reveals|Expands|Acquires|Loses|Falls|Plans)$/,
  
  // Very short/incomplete names
  tooShort: (name) => name && name.trim().length < 2,
  
  // Ends with incomplete sentence
  incomplete: (name) => name && (name.endsWith('...') || name.endsWith(' -') || name.endsWith(',') || name.endsWith('—')),
  
  // Starts with article/preposition (but NOT "The" which is common in fund names like "The Engine")
  startsWithArticle: (name) => name && /^(a |an |in |on |at |by |for |with )/i.test(name)
};

function isJunkName(name) {
  if (!name || typeof name !== 'string') return true;
  
  const nameTrimmed = name.trim();
  const nameLower = nameTrimmed.toLowerCase();
  const reasons = [];
  
  // Check array patterns
  for (const pattern of JUNK_PATTERNS.possessives) {
    if (nameLower.includes(pattern.toLowerCase())) {
      reasons.push(`Possessive/contraction: "${pattern}"`);
    }
  }
  
  // Check news patterns with word boundaries
  for (const pattern of JUNK_PATTERNS.newsPatterns) {
    const patternLower = pattern.toLowerCase().trim();
    // For "by ", match only as whole word (not "Abby")
    if (patternLower === 'by' && /\bby\s/i.test(nameTrimmed)) {
      reasons.push(`News pattern: "by "`);
    } else if (patternLower !== 'by' && nameLower.includes(patternLower)) {
      reasons.push(`News pattern: "${pattern}"`);
    }
  }
  
  for (const pattern of JUNK_PATTERNS.fragments) {
    if (nameLower.includes(pattern.toLowerCase())) {
      reasons.push(`Sentence fragment: "${pattern}"`);
    }
  }
  
  // Check exact tech giant match (not partial)
  for (const giant of JUNK_PATTERNS.techGiantsExact) {
    if (nameTrimmed === giant) {
      reasons.push(`Tech giant exact match: "${giant}"`);
    }
  }
  
  // Check financial notation regex
  if (JUNK_PATTERNS.financial.test(nameTrimmed)) {
    reasons.push('Contains financial notation (e.g., $42M)');
  }
  
  // Check action verb suffix
  if (JUNK_PATTERNS.actionVerbSuffix.test(nameTrimmed)) {
    reasons.push('Ends with action verb (article headline)');
  }
  
  // Check function-based patterns
  if (JUNK_PATTERNS.tooShort(nameTrimmed)) {
    reasons.push('Name too short (< 2 chars)');
  }
  if (JUNK_PATTERNS.incomplete(nameTrimmed)) {
    reasons.push('Incomplete sentence fragment');
  }
  if (JUNK_PATTERNS.startsWithArticle(nameTrimmed)) {
    reasons.push('Starts with article/preposition');
  }
  
  return reasons.length > 0 ? reasons : false;
}

async function scanStartups() {
  console.log('\n📊 Scanning startup_uploads table (ALL records)...\n');
  
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, tagline, status');
  
  if (error) {
    console.error('Error fetching startups:', error);
    return { junk: [], clean: [] };
  }
  
  const junk = [];
  const clean = [];
  
  for (const startup of startups) {
    const reasons = isJunkName(startup.name);
    if (reasons) {
      junk.push({ ...startup, reasons });
    } else {
      clean.push(startup);
    }
  }
  
  return { junk, clean, total: startups.length };
}

async function scanInvestors() {
  console.log('\n👥 Scanning investors table (ALL records)...\n');
  
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm');
  
  if (error) {
    console.error('Error fetching investors:', error);
    return { junk: [], clean: [] };
  }
  
  const junk = [];
  const clean = [];
  
  for (const investor of investors) {
    const reasons = isJunkName(investor.name);
    if (reasons) {
      junk.push({ ...investor, reasons });
    } else {
      clean.push(investor);
    }
  }
  
  return { junk, clean, total: investors.length };
}

async function deleteJunkStartups(junkIds, dryRun = true) {
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: Would delete ${junkIds.length} startups\n`);
    return;
  }
  
  console.log(`\n🗑️  Deleting ${junkIds.length} junk startups...`);
  
  // Delete in batches of 100
  for (let i = 0; i < junkIds.length; i += 100) {
    const batch = junkIds.slice(i, i + 100);
    const { error } = await supabase
      .from('startup_uploads')
      .delete()
      .in('id', batch);
    
    if (error) {
      console.error(`Error deleting batch ${i / 100 + 1}:`, error);
    } else {
      console.log(`✅ Deleted batch ${i / 100 + 1} (${batch.length} records)`);
    }
  }
}

async function deleteJunkInvestors(junkIds, dryRun = true) {
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: Would delete ${junkIds.length} investors\n`);
    return;
  }
  
  console.log(`\n🗑️  Deleting ${junkIds.length} junk investors...`);
  
  // Delete in batches of 100
  for (let i = 0; i < junkIds.length; i += 100) {
    const batch = junkIds.slice(i, i + 100);
    const { error } = await supabase
      .from('investors')
      .delete()
      .in('id', batch);
    
    if (error) {
      console.error(`Error deleting batch ${i / 100 + 1}:`, error);
    } else {
      console.log(`✅ Deleted batch ${i / 100 + 1} (${batch.length} records)`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('═'.repeat(70));
  console.log('🧹 DATABASE CLEANUP SCRIPT');
  console.log('═'.repeat(70));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚠️  EXECUTE (will delete data)'}`);
  console.log('═'.repeat(70));
  
  // Scan startups
  const startupResults = await scanStartups();
  console.log(`\n📈 STARTUP RESULTS:`);
  console.log(`   Total: ${startupResults.total}`);
  console.log(`   Clean: ${startupResults.clean?.length || 0}`);
  console.log(`   Junk:  ${startupResults.junk?.length || 0}`);
  
  // Show sample junk startups
  if (startupResults.junk && startupResults.junk.length > 0) {
    console.log('\n🗑️  Sample junk startups (first 20):');
    startupResults.junk.slice(0, 20).forEach((s, i) => {
      console.log(`   ${i + 1}. "${s.name}" - ${s.reasons[0]}`);
    });
    
    // Save full list to file
    const fs = require('fs');
    const junkFile = 'cleanup-junk-startups.json';
    fs.writeFileSync(junkFile, JSON.stringify(startupResults.junk, null, 2));
    console.log(`\n💾 Full list saved to: ${junkFile}`);
  }
  
  // Scan investors
  const investorResults = await scanInvestors();
  console.log(`\n📈 INVESTOR RESULTS:`);
  console.log(`   Total: ${investorResults.total}`);
  console.log(`   Clean: ${investorResults.clean?.length || 0}`);
  console.log(`   Junk:  ${investorResults.junk?.length || 0}`);
  
  // Show sample junk investors
  if (investorResults.junk && investorResults.junk.length > 0) {
    console.log('\n🗑️  Sample junk investors (first 20):');
    investorResults.junk.slice(0, 20).forEach((i, idx) => {
      console.log(`   ${idx + 1}. "${i.name}" - ${i.reasons[0]}`);
    });
    
    // Save full list to file
    const fs = require('fs');
    const junkFile = 'cleanup-junk-investors.json';
    fs.writeFileSync(junkFile, JSON.stringify(investorResults.junk, null, 2));
    console.log(`\n💾 Full list saved to: ${junkFile}`);
  }
  
  // Execute deletion if requested
  if (startupResults.junk && startupResults.junk.length > 0) {
    await deleteJunkStartups(
      startupResults.junk.map(s => s.id),
      dryRun
    );
  }
  
  if (investorResults.junk && investorResults.junk.length > 0) {
    await deleteJunkInvestors(
      investorResults.junk.map(i => i.id),
      dryRun
    );
  }
  
  console.log('\n═'.repeat(70));
  if (dryRun) {
    console.log('✅ DRY RUN COMPLETE');
    console.log('\nTo actually delete junk data, run:');
    console.log('   node scripts/cleanup-database.js --execute');
  } else {
    console.log('✅ CLEANUP COMPLETE');
    console.log('\n⚠️  IMPORTANT: Run match-regenerator to rebuild matches with clean data:');
    console.log('   node match-regenerator.js');
  }
  console.log('═'.repeat(70));
}

main().catch(console.error);
