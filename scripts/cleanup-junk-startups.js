/**
 * Find and Remove Junk Startup Names
 * Identifies and optionally removes low-quality or test startup entries
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Patterns that indicate junk entries
const JUNK_PATTERNS = [
  /^test/i,
  /^demo/i,
  /^sample/i,
  /^placeholder/i,
  /^asdf/i,
  /^qwerty/i,
  /^untitled/i,
  /^new startup/i,
  /^startup \d+/i,
  /^abc/i,
  /^\d+$/,  // Just numbers
  /^[a-z]$/i, // Single letter
  /^xxx/i,
  /^zzz/i,
  /lorem ipsum/i,
  /^the startup/i,
  /^my startup/i,
  /^temp/i,
  /^draft/i,
  /^pending/i,
  /^unknown/i,
  /^unnamed/i,
  /^n\/a$/i,
  /^tbd$/i,
  /^to be determined/i,
];

// Very short names (likely junk)
const MIN_NAME_LENGTH = 2;

// Check if a name matches junk patterns
function isJunkName(name) {
  if (!name) return true;
  
  const trimmed = name.trim();
  
  // Empty or too short
  if (trimmed.length <= MIN_NAME_LENGTH) return true;
  
  // Matches a junk pattern
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // All special characters (no alphanumeric)
  if (!/[a-zA-Z0-9]/.test(trimmed)) return true;
  
  // Excessive special characters (>50% of name)
  const specialChars = trimmed.match(/[^a-zA-Z0-9\s]/g) || [];
  if (specialChars.length > trimmed.length / 2) return true;
  
  return false;
}

async function findJunkStartups() {
  console.log('🔍 Scanning for junk startup names...\n');
  
  // Check startup_uploads table
  const { data: uploads, error: uploadsError } = await supabase
    .from('startup_uploads')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false });
  
  if (uploadsError) {
    console.error('❌ Error fetching startup_uploads:', uploadsError);
    return;
  }
  
  // Check discovered_startups table
  const { data: discovered, error: discoveredError } = await supabase
    .from('discovered_startups')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });
  
  if (discoveredError) {
    console.error('❌ Error fetching discovered_startups:', discoveredError);
    return;
  }
  
  console.log(`📊 Total startups in startup_uploads: ${uploads.length}`);
  console.log(`📊 Total startups in discovered_startups: ${discovered.length}\n`);
  
  // Find junk in startup_uploads
  const junkUploads = uploads.filter(s => isJunkName(s.name));
  
  console.log(`🗑️  Found ${junkUploads.length} junk entries in startup_uploads:\n`);
  junkUploads.forEach(s => {
    console.log(`  - "${s.name}" (${s.status}, ${s.id})`);
  });
  
  // Find junk in discovered_startups
  const junkDiscovered = discovered.filter(s => isJunkName(s.name));
  
  console.log(`\n🗑️  Found ${junkDiscovered.length} junk entries in discovered_startups:\n`);
  junkDiscovered.slice(0, 50).forEach(s => {
    console.log(`  - "${s.name}" (${s.id})`);
  });
  
  if (junkDiscovered.length > 50) {
    console.log(`  ... and ${junkDiscovered.length - 50} more`);
  }
  
  // Also check for duplicates
  const nameCountsUploads = {};
  uploads.forEach(s => {
    if (s.name) {
      const normalized = s.name.toLowerCase().trim();
      nameCountsUploads[normalized] = (nameCountsUploads[normalized] || 0) + 1;
    }
  });
  
  const duplicates = Object.entries(nameCountsUploads)
    .filter(([name, count]) => count > 1 && !isJunkName(name))
    .sort((a, b) => b[1] - a[1]);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} duplicate names in startup_uploads:\n`);
    duplicates.slice(0, 20).forEach(([name, count]) => {
      console.log(`  - "${name}" (${count} times)`);
    });
  }
  
  return {
    junkUploads,
    junkDiscovered,
    duplicates,
    totalJunk: junkUploads.length + junkDiscovered.length
  };
}

async function removeJunkStartups(dryRun = true) {
  const results = await findJunkStartups();
  
  if (!results || results.totalJunk === 0) {
    console.log('\n✅ No junk entries found!');
    return;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total junk entries to remove: ${results.totalJunk}`);
  console.log(`${'='.repeat(60)}\n`);
  
  if (dryRun) {
    console.log('🔒 DRY RUN MODE - No deletions will be performed');
    console.log('Run with --delete flag to actually remove these entries\n');
    return;
  }
  
  console.log('🗑️  DELETING JUNK ENTRIES...\n');
  
  // Delete from startup_uploads
  if (results.junkUploads.length > 0) {
    const uploadIds = results.junkUploads.map(s => s.id);
    const { error: deleteUploadsError } = await supabase
      .from('startup_uploads')
      .delete()
      .in('id', uploadIds);
    
    if (deleteUploadsError) {
      console.error('❌ Error deleting from startup_uploads:', deleteUploadsError);
    } else {
      console.log(`✅ Deleted ${results.junkUploads.length} entries from startup_uploads`);
    }
  }
  
  // Delete from discovered_startups
  if (results.junkDiscovered.length > 0) {
    const discoveredIds = results.junkDiscovered.map(s => s.id);
    const { error: deleteDiscoveredError } = await supabase
      .from('discovered_startups')
      .delete()
      .in('id', discoveredIds);
    
    if (deleteDiscoveredError) {
      console.error('❌ Error deleting from discovered_startups:', deleteDiscoveredError);
    } else {
      console.log(`✅ Deleted ${results.junkDiscovered.length} entries from discovered_startups`);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
}

// Run the script
const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete') || args.includes('-d');

removeJunkStartups(!shouldDelete).catch(console.error);
