#!/usr/bin/env node
/**
 * GARBAGE CLEANUP — Identify and remove test/fake/nonsense startup names (approved rows)
 * Uses lib/startupNameValidator + legacy patterns (see isGarbage).
 *
 * Usage:
 *   node scripts/cleanup-garbage.js              # Dry run: list matches (sample + count)
 *   node scripts/cleanup-garbage.js --reject     # Set status=rejected (recommended; reversible)
 *   node scripts/cleanup-garbage.js --delete     # Hard delete rows + related matches (destructive)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('../lib/startupNameValidator');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const DELETE_MODE = process.argv.includes('--delete');
const REJECT_MODE = process.argv.includes('--reject');

const LIST_LIMIT = 200;
const REJECT_BATCH = 100;
const NOTE_PREFIX = 'auto-rejected: invalid startup name (cleanup-garbage.js --reject)';

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
  /month-old/i,            // "Eight-month-old", etc. (headline fragments)
  /^42San Francisco/i,     // concatenated YC batch data
  // Financial institutions (not startups)
  /^Morgan Stanley$/i,
  /^Seligman Investments$/i,
  /^Arrow Financial$/i,
  /^Goldman Sachs$/i,
  /^J[.\s]?P\.?\s*Morgan$/i,
  /^CNBC\b/i,
  // Framework/library names (often mistaken for startups)
  /^Next\.js$/i,
  /^React$/i,
  // Headline fragments from terminal output
  /^Can\s+Bpifrance/i,
  /^Is\s+Latest\s+Clean\s+Energy/i,
  /^FAST42\s+Conclave/i,
  /^Flagship\s+Dubai\s*$/i,
  /^LinkedIn\.\s+Now\s+/i,
  /^It\s+Cleafy\s*$/i,    // "It" + typo
  /^Gets\s+Prison\s+Time/i,
  /^Huge\s+Money\s+For\s+AI/i,
  /^Red\s+Team\s+Your\s+AI/i,
  /^State\s+Of\s+Venture/i,
  /^Majority\s+Stake\s+In/i,
  /^Wealthy\s+Runs\s+Into\s+AI/i,
  /^Learnt\s+Studying/i,
  /^Seek\s+Labs\s+Awarded/i,
  /^Edhat\s+Padilla\s*$/i,  // person name fragment
  /^CNBC\s+Daily\s+Open/i,
  /^Opening$/i,
  /^Michael\s+Seibel$/i,   // YC partner, not a startup
  /^Bybit\s+Pay\s*$/i,     // product, often headline fragment
  /^Post\s+[A-Z]/,         // "Post Robotera", "Post Jaaq" — headline fragments
  // Auxiliary verb suffix — "Aetherflux Has", "Startup Is" — truncated headlines
  /\s+(Has|Had|Have|Is|Are|Was|Were|Will|Can|Did|Does)\s*$/i,
  // Headline-verb phrase fragments — "Tom Brady Just Took", "Why Merck Is Buying"
  /^Why\s+[A-Z]/i,
  /\bJust\s+(Took|Did|Made|Got|Raised|Said|Closed|Bought|Sold)\b/i,
  // Prepositional acquisition/deal fragments — "Acquisition Of HealthTech Solutions"
  /^Acquisition\s+Of\b/i,
  /^Investment\s+In\b/i,
  /^(Million|Billion)\s+(Dollar|Investment|Funding)\b/i,
  // Site-name concatenations — "Techcrunch.com Granola"
  /^[a-z]+\.(com|co|io|net|org)\s+[A-Z]/i,
  // Government/utility/regulatory entities — never startups
  /\b(Commission|Department|Bureau|Authority|Agency|Ministry|Council|Municipality|Prefecture)\s*$/i,
  // PR/law firms acting as subjects in news headlines
  /^Ruder\s+Finn\b/i,
  // Pure descriptor fragments — "student debt and", "near-millionaires and"
  /\s+and\s*$/i,                    // trailing "and"
  /^near-/i,                        // "near-millionaires", "near-unicorn" fragments
  // "Biggest Off", "Biggest X" — superlative headline fragments
  /^Biggest\s+(Off|On|In|Out|Up|Down)\b/i,
  // "Subscription Churn Early-Warning System" — product description, not a name
  /Early-Warning\s+System/i,
  // Local/generic investment group descriptors
  /^Local\s+(Investment|Investor|Venture)\s+Group\b/i,
  // Pure generic category words — "Streetwear", "Oral Health", etc.
  /^Oral\s+Health\s*$/i,
  /^Streetwear\s*$/i,
  // "Sony Said Near" / "[Name] Said [word]" — headline attribution fragments
  /\bSaid\s+Near\b/i,
  /^[A-Z][a-z]+\s+Said\s+[A-Z]/,
];

// Known-good startups — never treat as garbage (short names, number-prefixed, etc.)
const KNOWN_GOOD_STARTUPS = new Set([
  '1password', 'deel', 'mews', 'wise', 'stripe', 'notion', 'linear',
  'vercel', 'supabase', 'airtable', 'figma', 'lattice', 'rippling',
  'ramp', 'brex', 'mercury', 'replit', 'rsc', 'mode', 'webflow', 'run labs',
  'gusto', 'ripple',   'opensea', 'dune', 'etherscan', 'foundry',
  'opyn', 'compound', 'aave', 'uniswap', 'dydx',
  // YC-backed / YC alum (descriptor prefix but legitimate startups)
  'yc-backed denki', 'yc-backed diligent ai', 'yc-backed escape', 'yc-backed mandel ai',
  'yc alum mendel', 'yc alum pasito',
].map(s => s.toLowerCase()));

// Check: legacy patterns OR shared validator (headline fragments, law firm phrases, etc.)
function isGarbage(name) {
  if (!name || name.trim().length === 0) return true;
  const n = name.trim();

  // Never flag known-good startups
  if (KNOWN_GOOD_STARTUPS.has(n.toLowerCase())) return false;

  // Legacy garbage patterns
  if (GARBAGE_PATTERNS.some(p => p.test(n))) return true;

  // Very short names (1 char only)
  if (n.length <= 1) return true;

  // Shared validator: catches "Man Pleads Guilty", "Goodwin Advises Shellworks On", etc.
  const check = isValidStartupName(n);
  if (!check.isValid) return true;

  return false;
}

module.exports = { isGarbage };

async function run() {
  if (DELETE_MODE && REJECT_MODE) {
    console.error('Use either --reject or --delete, not both.');
    process.exit(1);
  }

  const modeLabel = DELETE_MODE
    ? '🗑️  DELETE MODE'
    : REJECT_MODE
      ? '📛 REJECT MODE (status=rejected)'
      : '🔍 DRY RUN';
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  GARBAGE CLEANUP — ${modeLabel}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Fetch all approved startups (paginated; stable order so no row is skipped/duplicated)
  let allData = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, status, created_at')
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching startups:', error);
      return;
    }
    allData = allData.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`📊 Total approved startups: ${allData.length}\n`);

  // Find garbage entries
  const garbage = allData.filter(s => isGarbage(s.name));
  garbage.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  console.log(`🗑️  GARBAGE ENTRIES FOUND: ${garbage.length}\n`);
  garbage.slice(0, LIST_LIMIT).forEach(s => {
    console.log(`  GOD ${String(s.total_god_score).padStart(3)} | ${s.name}`);
  });
  if (garbage.length > LIST_LIMIT) {
    console.log(`  ... and ${garbage.length - LIST_LIMIT} more (not listed)\n`);
  }

  if (REJECT_MODE && garbage.length > 0) {
    const now = new Date().toISOString();
    const ids = garbage.map(s => s.id);
    let updated = 0;
    let failed = 0;
    console.log(`\n📛 Rejecting ${ids.length} rows (batch size ${REJECT_BATCH})...`);
    for (let i = 0; i < ids.length; i += REJECT_BATCH) {
      const batch = ids.slice(i, i + REJECT_BATCH);
      const { error } = await supabase
        .from('startup_uploads')
        .update({
          status: 'rejected',
          admin_notes: `auto-rejected: invalid startup name (cleanup-garbage.js) — ${NOTE_PREFIX}`,
          reviewed_at: now,
        })
        .in('id', batch)
        .eq('status', 'approved');
      if (error) {
        console.error(`Batch error at ${i}:`, error.message);
        failed += batch.length;
      } else {
        updated += batch.length;
      }
      process.stdout.write(`  ${Math.min(i + REJECT_BATCH, ids.length)}/${ids.length}\r`);
    }
    console.log(`\n✅ Rejected ${updated} rows.${failed ? ` Failed batches: ${failed}.` : ''}`);
    console.log('   Re-run: npm run recalc if you need GOD stats / matches refreshed.\n');
  } else if (DELETE_MODE && garbage.length > 0) {
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

    // Delete social_signals (FK: social_signals_startup_id_fkey)
    const { error: socialError } = await supabase
      .from('social_signals')
      .delete()
      .in('startup_id', ids);
    
    if (socialError && socialError.code !== '42P01') {
      console.error('Error deleting social signals:', socialError);
    } else {
      console.log('  ✅ Removed social signals');
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
  } else if (!DELETE_MODE && !REJECT_MODE && garbage.length > 0) {
    console.log(`\n💡 To remove from the active pool (recommended): node scripts/cleanup-garbage.js --reject`);
    console.log(`   To hard-delete rows: node scripts/cleanup-garbage.js --delete`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  const doneMsg =
    DELETE_MODE || REJECT_MODE ? 'CLEANUP COMPLETE' : 'DRY RUN COMPLETE — No changes made.';
  console.log(`  ${doneMsg}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

if (require.main === module) {
  run().catch(console.error);
}
