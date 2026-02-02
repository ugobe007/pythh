#!/usr/bin/env tsx
/**
 * List Investors with UUIDs
 * Helper script to find investor IDs for faith signal extraction
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function main() {
  // Get total count
  const { count } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });

  // Parse search argument
  const searchTerm = process.argv[2];
  
  let query = supabase
    .from('investors')
    .select('id, name, firm, bio, linkedin_url');

  if (searchTerm) {
    query = query.or(`name.ilike.%${searchTerm}%,firm.ilike.%${searchTerm}%`);
  } else {
    query = query.order('name').limit(50);
  }

  const { data: investors, error } = await query;

  if (error) {
    console.error('Error fetching investors:', error.message);
    process.exit(1);
  }

  if (!investors || investors.length === 0) {
    console.log(searchTerm 
      ? `No investors found matching "${searchTerm}"`
      : 'No investors found.');
    process.exit(0);
  }

  console.log(`\n🔎 Investors (${investors.length} shown, ${count} total in database)\n`);
  
  if (!searchTerm) {
    console.log('💡 Tip: Search by name/firm: npx tsx scripts/list-investors.ts "Sequoia"\n');
  }

  console.log('UUID'.padEnd(38) + ' | Name'.padEnd(35) + ' | Firm');
  console.log('-'.repeat(120));

  for (const inv of investors) {
    const name = (inv.name || 'Unknown').substring(0, 33).padEnd(35);
    const firm = (inv.firm || '').substring(0, 40);
    console.log(`${inv.id} | ${name} | ${firm}`);
  }

  console.log('\n💡 To extract faith signals:');
  console.log('npx tsx scripts/faith-signal-extractor.ts \\');
  console.log('  --investor-id "<paste-uuid-here>" \\');
  console.log('  --investor-name "Sequoia Capital" \\');
  console.log('  --url "https://www.sequoiacap.com/article/vision/"');
}

main().catch(console.error);
