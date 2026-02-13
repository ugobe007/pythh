/**
 * Analyze startup names to identify quality issues
 * Shows patterns of poor extractions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeStartupNames() {
  console.log('🔍 Analyzing startup name quality...\n');
  
  // Get recent startups from both tables
  const { data: uploads, error: uploadsError } = await supabase
    .from('startup_uploads')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  
  if (uploadsError) {
    console.error('❌ Error fetching startup_uploads:', uploadsError);
  }
  
  const { data: discovered, error: discoveredError } = await supabase
    .from('discovered_startups')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  
  if (discoveredError) {
    console.error('❌ Error fetching discovered_startups:', discoveredError);
  }
  
  if (!uploads || !discovered) {
    console.error('❌ Failed to fetch data from database');
    return;
  }
  
  console.log(`📊 Analyzing ${uploads.length} startup_uploads and ${discovered.length} discovered_startups\n`);
  
  // Categorize names
  const categories = {
    singleWord: [],
    twoWords: [],
    threeOrMore: [],
    hasNumbers: [],
    allCaps: [],
    startsWithGeneric: [],
    suspiciousPatterns: [],
  };
  
  function analyzeNames(startups, tableName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${tableName}`);
    console.log(`${'='.repeat(60)}\n`);
    
    for (const s of startups) {
      if (!s.name) continue;
      
      const name = s.name.trim();
      const words = name.split(/\s+/);
      
      // Single word names (often fragments)
      if (words.length === 1) {
        categories.singleWord.push({ name, id: s.id, table: tableName });
      }
      
      // Names with numbers
      if (/\d/.test(name)) {
        categories.hasNumbers.push({ name, id: s.id, table: tableName });
      }
      
      // All caps (often acronyms/junk)
      if (name === name.toUpperCase() && name.length >= 2) {
        categories.allCaps.push({ name, id: s.id, table: tableName });
      }
      
      // Starts with generic terms
      const genericStarts = /^(The|A|An|This|That|These|New|Former|Ex-|Top|Big|Several|Many|Some|All)\s+/i;
      if (genericStarts.test(name)) {
        categories.startsWithGeneric.push({ name, id: s.id, table: tableName });
      }
      
      // Suspicious patterns
      const suspiciousPatterns = [
        /^(Test|Demo|Sample|Draft|Temp)/i,
        /\b(Raises|Secures|Lands|Bags|Gets|Wins|Takes)\b/i,  // Verb fragments
        /\b(Funding|Investment|Round|Series|Seed)\b$/i,      // Funding term endings
        /^(How|Why|What|When|Where)\s+/i,                    // Question starts
        /['']s\s+/,                                           // Possessives
        /\bCEO\b|\bCTO\b|\bCFO\b/i,                           // Job titles
        /(Startup|Company|Firm)\s*$/i,                       // Generic suffixes
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(name)) {
          categories.suspiciousPatterns.push({ 
            name, 
            id: s.id, 
            table: tableName,
            pattern: pattern.toString()
          });
          break;
        }
      }
    }
  }
  
  analyzeNames(uploads, 'startup_uploads');
  analyzeNames(discovered, 'discovered_startups');
  
  // Report findings
  console.log(`\n${'='.repeat(60)}`);
  console.log('ANALYSIS RESULTS');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`🔤 Single-word names: ${categories.singleWord.length}`);
  if (categories.singleWord.length > 0) {
    console.log('   Examples:');
    categories.singleWord.slice(0, 15).forEach(s => {
      console.log(`   - "${s.name}" (${s.table})`);
    });
    if (categories.singleWord.length > 15) {
      console.log(`   ... and ${categories.singleWord.length - 15} more\n`);
    }
  }
  
  console.log(`\n🔢 Names with numbers: ${categories.hasNumbers.length}`);
  if (categories.hasNumbers.length > 0) {
    console.log('   Examples:');
    categories.hasNumbers.slice(0, 10).forEach(s => {
      console.log(`   - "${s.name}" (${s.table})`);
    });
  }
  
  console.log(`\n📢 ALL CAPS names: ${categories.allCaps.length}`);
  if (categories.allCaps.length > 0) {
    console.log('   Examples:');
    categories.allCaps.slice(0, 10).forEach(s => {
      console.log(`   - "${s.name}" (${s.table})`);
    });
  }
  
  console.log(`\n🏷️  Starts with generic terms: ${categories.startsWithGeneric.length}`);
  if (categories.startsWithGeneric.length > 0) {
    console.log('   Examples:');
    categories.startsWithGeneric.slice(0, 10).forEach(s => {
      console.log(`   - "${s.name}" (${s.table})`);
    });
  }
  
  console.log(`\n⚠️  Suspicious patterns: ${categories.suspiciousPatterns.length}`);
  if (categories.suspiciousPatterns.length > 0) {
    console.log('   Examples:');
    const shown = new Set();
    categories.suspiciousPatterns.slice(0, 20).forEach(s => {
      if (!shown.has(s.name)) {
        console.log(`   - "${s.name}" (${s.table})`);
        shown.add(s.name);
      }
    });
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('RECOMMENDATIONS');
  console.log(`${'='.repeat(60)}\n`);
  
  const totalIssues = 
    categories.singleWord.length +
    categories.hasNumbers.length +
    categories.allCaps.length +
    categories.startsWithGeneric.length +
    categories.suspiciousPatterns.length;
  
  // Deduplicate issues (some names trigger multiple categories)
  const uniqueIds = new Set();
  [
    ...categories.singleWord,
    ...categories.hasNumbers,
    ...categories.allCaps,
    ...categories.startsWithGeneric,
    ...categories.suspiciousPatterns,
  ].forEach(item => uniqueIds.add(item.id));
  
  console.log(`📊 Total entries with potential issues: ${uniqueIds.size}`);
  console.log(`📊 Total issue occurrences: ${totalIssues}`);
  console.log(`\n💡 Parser needs improvement in:`);
  console.log(`   1. Better entity extraction (too many fragments)`);
  console.log(`   2. Generic term filtering (articles, quantifiers)`);
  console.log(`   3. Verb/action word detection`);
  console.log(`   4. Possessive handling`);
  console.log(`   5. Job title detection`);
}

analyzeStartupNames().catch(console.error);
