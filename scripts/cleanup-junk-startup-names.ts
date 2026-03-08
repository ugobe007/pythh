/**
 * Cleanup Junk Startup Names
 * Identifies and fixes/removes low-quality startup names like "Weekly Firgun"
 * 
 * Usage:
 *   npx tsx scripts/cleanup-junk-startup-names.ts --dry-run  # Preview changes
 *   npx tsx scripts/cleanup-junk-startup-names.ts --fix      # Apply fixes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isValidStartupName } from '../server/utils/startupNameValidator';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use the shared validator
function isJunkName(name: string | null | undefined): { isJunk: boolean; reason?: string } {
  const validation = isValidStartupName(name);
  return {
    isJunk: !validation.isValid,
    reason: validation.reason
  };
}

interface JunkStartup {
  id: string;
  name: string;
  status: string;
  reason: string;
}

async function findJunkStartups(): Promise<{ uploads: JunkStartup[]; discovered: JunkStartup[] }> {
  console.log('🔍 Scanning for junk startup names...\n');
  
  // Fetch all startup_uploads
  let allUploads: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, status, website, created_at')
      .not('name', 'is', null)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('❌ Error fetching startup_uploads:', error);
      break;
    }
    
    if (!startups || startups.length === 0) {
      hasMore = false;
    } else {
      allUploads = allUploads.concat(startups);
      hasMore = startups.length === pageSize;
      page++;
      console.log(`  Fetched ${allUploads.length} startup_uploads so far...`);
    }
  }
  
  // Fetch all discovered_startups
  let allDiscovered: any[] = [];
  page = 0;
  hasMore = true;
  
  while (hasMore) {
    const { data: discovered, error } = await supabase
      .from('discovered_startups')
      .select('id, name, created_at')
      .not('name', 'is', null)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('❌ Error fetching discovered_startups:', error);
      break;
    }
    
    if (!discovered || discovered.length === 0) {
      hasMore = false;
    } else {
      allDiscovered = allDiscovered.concat(discovered);
      hasMore = discovered.length === pageSize;
      page++;
      console.log(`  Fetched ${allDiscovered.length} discovered_startups so far...`);
    }
  }
  
  console.log(`📊 Total startup_uploads: ${allUploads.length}`);
  console.log(`📊 Total discovered_startups: ${allDiscovered.length}\n`);
  
  const junkUploads: JunkStartup[] = [];
  const junkDiscovered: JunkStartup[] = [];
  
  for (const startup of allUploads) {
    const validation = isJunkName(startup.name);
    if (validation.isJunk) {
      junkUploads.push({
        id: startup.id,
        name: startup.name,
        status: startup.status || 'unknown',
        reason: validation.reason || 'unknown',
      });
    }
  }
  
  for (const startup of allDiscovered) {
    const validation = isJunkName(startup.name);
    if (validation.isJunk) {
      junkDiscovered.push({
        id: startup.id,
        name: startup.name,
        status: 'discovered', // discovered_startups don't have status
        reason: validation.reason || 'unknown',
      });
    }
  }
  
  return { uploads: junkUploads, discovered: junkDiscovered };
}

async function cleanupJunkNames(dryRun: boolean = true) {
  const { uploads: junkUploads, discovered: junkDiscovered } = await findJunkStartups();
  const totalJunk = junkUploads.length + junkDiscovered.length;
  
  if (totalJunk === 0) {
    console.log('✅ No junk names found!');
    return;
  }
  
  console.log(`\n🗑️  Found ${junkUploads.length} junk names in startup_uploads`);
  console.log(`🗑️  Found ${junkDiscovered.length} junk names in discovered_startups`);
  console.log(`🗑️  Total: ${totalJunk} junk names\n`);
  
  // Group by reason (combine both tables)
  const allJunk = [...junkUploads, ...junkDiscovered];
  const byReason: Record<string, JunkStartup[]> = {};
  allJunk.forEach(s => {
    if (!byReason[s.reason]) byReason[s.reason] = [];
    byReason[s.reason].push(s);
  });
  
  // Show examples
  Object.entries(byReason).slice(0, 10).forEach(([reason, items]) => {
    console.log(`  ${reason}: ${items.length} entries`);
    items.slice(0, 5).forEach(item => {
      console.log(`    - "${item.name}" (${item.status}, ${item.id.slice(0, 8)}...)`);
    });
    if (items.length > 5) {
      console.log(`    ... and ${items.length - 5} more`);
    }
    console.log();
  });
  
  if (dryRun) {
    console.log('\n🔒 DRY RUN MODE - No changes will be made');
    console.log('Run with --fix flag to actually update/delete these entries\n');
    return;
  }
  
  console.log('\n🗑️  CLEANING UP JUNK NAMES...\n');
  
  // Update startup_uploads status to 'rejected' (batch in groups of 100)
  if (junkUploads.length > 0) {
    const idsToReject = junkUploads.map(s => s.id);
    const batchSize = 100;
    let updated = 0;
    let errors = 0;
    
    for (let i = 0; i < idsToReject.length; i += batchSize) {
      const batch = idsToReject.slice(i, i + batchSize);
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({ status: 'rejected' })
        .in('id', batch)
        .neq('status', 'rejected'); // Don't update already rejected
      
      if (updateError) {
        console.error(`❌ Error updating startup_uploads batch ${Math.floor(i / batchSize) + 1}:`, updateError.message);
        errors++;
      } else {
        updated += batch.length;
        if (i % 500 === 0) {
          console.log(`  Updated ${updated} startup_uploads so far...`);
        }
      }
    }
    
    console.log(`✅ Updated ${updated} startup_uploads to 'rejected' status`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} batches had errors`);
    }
  }
  
  // Delete from discovered_startups (batch in groups of 100)
  if (junkDiscovered.length > 0) {
    const idsToDelete = junkDiscovered.map(s => s.id);
    const batchSize = 100;
    let deleted = 0;
    let errors = 0;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('discovered_startups')
        .delete()
        .in('id', batch);
      
      if (deleteError) {
        console.error(`❌ Error deleting discovered_startups batch ${Math.floor(i / batchSize) + 1}:`, deleteError.message);
        errors++;
      } else {
        deleted += batch.length;
        if (i % 500 === 0) {
          console.log(`  Deleted ${deleted} discovered_startups so far...`);
        }
      }
    }
    
    console.log(`✅ Deleted ${deleted} discovered_startups`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} batches had errors`);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
}

// Run the script
const args = process.argv.slice(2);
const dryRun = !args.includes('--fix') && !args.includes('-f');

cleanupJunkNames(dryRun).catch(console.error);
