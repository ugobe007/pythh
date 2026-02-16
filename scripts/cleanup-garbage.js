#!/usr/bin/env node
/**
 * GARBAGE CLEANUP — Identify and remove test/fake/nonsense startups
 * Usage:
 *   node scripts/cleanup-garbage.js            # Dry run (list garbage)
 *   node scripts/cleanup-garbage.js --delete   # Actually delete them
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const DELETE_MODE = process.argv.includes('--delete');

// Patterns that indicate garbage/test entries
const GARBAGE_PATTERNS = [
  /^smoketest/i,
  /^testnew/i,
  /^speedtest/i,
  /^example-test/i,
  /^anotherfake/i,
  /^test\d/i,
  /^fake\d/i,
  /^please fund/i,
  /^invest$/i,
  /^interesting learnings/i,
  /^ces 20\d\d$/i,
  /^income tax$/i,
  /^cdixon$/i,
  /^nyse$/i,
  /^thenextweb$/i,
  /^grayscale$/i,
  /^winklevoss$/i,
  /^\w+waitlist$/i,
  /^[a-z]+\d{5,}/i,         // names with long number suffixes like "Smoketest1770609039"
  /eric schmidt.backed/i,
  /enterprise genai startup/i,
  /^eliot$/i,
  /^sam bankman/i,
  /^elevenl?abs founder/i,
  /^\d+$/,                   // pure numbers
  /^(the|a|an|and|or|is|to|do)$/i,  // single stop words
  /^\$\d+[BMK]$/i,          // "$11B" type entries
  /^\d{6}\s/,               // "202604 Netflix" type entries
  /^"we$/i, /^"$/,          // broken quote fragments
  /^9gag.+kong/i,           // "9gagHong Kong..." concatenated garbage
  /^oil$/i,
  /^app$/i,
  /^push$/i,
  /^['\u2018\u2019"\u201C\u201D\(]/,   // starts with any quote or paren — broken text fragments
  /^\d+-year-old/i,        // "49-year-old" type fragments
  /^42San Francisco/i,     // concatenated YC batch data
];

// Additional check: names that are clearly not startup names
function isGarbage(name) {
  if (!name || name.trim().length === 0) return true;
  const n = name.trim();
  
  // Match any garbage pattern
  if (GARBAGE_PATTERNS.some(p => p.test(n))) return true;
  
  // Very short names (1 char only — 2-char names like "Ro" could be real)
  if (n.length <= 1) return true;
  
  return false;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  GARBAGE CLEANUP — ${DELETE_MODE ? '🗑️  DELETE MODE' : '🔍 DRY RUN (add --delete to remove)'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Fetch all approved startups (paginated to get all 7000+)
  let allData = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, status, created_at')
      .eq('status', 'approved')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching startups:', error);
      return;
    }
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`📊 Total approved startups: ${allData.length}\n`);

  // Find garbage entries
  const garbage = allData.filter(s => isGarbage(s.name));
  garbage.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  console.log(`🗑️  GARBAGE ENTRIES FOUND: ${garbage.length}\n`);
  garbage.forEach(s => {
    console.log(`  GOD ${String(s.total_god_score).padStart(3)} | ${s.name}`);
  });

  // Also find suspicious entries that might be garbage
  console.log('\n📋 SUSPICIOUS (not auto-deleted, review manually):');
  const suspicious = allData.filter(s => {
    if (isGarbage(s.name)) return false;
    const n = (s.name || '').trim();
    // Generic/non-startup names
    return n.length <= 4 || 
           /^[A-Z]{2,4}$/.test(n) || // All-caps abbreviations like "AI", "SaaS"
           /^\d/.test(n);             // starts with number
  });
  suspicious.sort((a, b) => a.name.localeCompare(b.name));
  suspicious.forEach(s => {
    console.log(`  GOD ${String(s.total_god_score).padStart(3)} | ${s.name}`);
  });

  if (DELETE_MODE && garbage.length > 0) {
    console.log(`\n🗑️  Deleting ${garbage.length} garbage entries...`);
    
    const ids = garbage.map(s => s.id);
    
    // First delete any matches referencing these startups
    const { error: matchError } = await supabase
      .from('startup_investor_matches')
      .delete()
      .in('startup_id', ids);
    
    if (matchError) {
      console.error('Error deleting matches:', matchError);
    } else {
      console.log('  ✅ Removed associated matches');
    }

    // Delete score_history entries
    const { error: histError } = await supabase
      .from('score_history')
      .delete()
      .in('startup_id', ids);
    
    if (histError && histError.code !== '42P01') {
      console.error('Error deleting score history:', histError);
    } else {
      console.log('  ✅ Removed score history');
    }

    // Delete match_gen_logs entries
    const { error: logError } = await supabase
      .from('match_gen_logs')
      .delete()
      .in('startup_id', ids);
    
    if (logError && logError.code !== '42P01') {
      console.error('Error deleting match gen logs:', logError);
    } else {
      console.log('  ✅ Removed match gen logs');
    }

    // Now delete the startups themselves
    const { error: deleteError, count } = await supabase
      .from('startup_uploads')
      .delete()
      .in('id', ids);
    
    if (deleteError) {
      console.error('Error deleting startups:', deleteError);
    } else {
      console.log(`  ✅ Deleted ${garbage.length} garbage startups`);
    }
  } else if (!DELETE_MODE && garbage.length > 0) {
    console.log(`\n💡 To delete these ${garbage.length} entries: node scripts/cleanup-garbage.js --delete`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  ${DELETE_MODE ? 'CLEANUP COMPLETE' : 'DRY RUN COMPLETE — No changes made.'}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

run().catch(console.error);
