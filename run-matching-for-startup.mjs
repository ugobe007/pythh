import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const startupId = '697d7775-8c3c-43a9-9b3b-927cf99d88cb';

console.log('Checking startup and generating matches...\n');

// Check if startup exists
const { data: startup, error: startupError } = await supabase
  .from('startup_uploads')
  .select('*')
  .eq('id', startupId)
  .single();

if (startupError || !startup) {
  console.error('Startup not found:', startupError);
  process.exit(1);
}

console.log(`✓ Found startup: ${startup.name || 'Unnamed'}`);
console.log(`  GOD Score: ${startup.total_god_score || 'Not scored yet'}`);
console.log(`  Status: ${startup.status}`);
console.log(`  Sectors: ${JSON.stringify(startup.sectors)}\n`);

// Check existing matches
const { count } = await supabase
  .from('startup_investor_matches')
  .select('*', { count: 'exact', head: true })
  .eq('startup_id', startupId);

console.log(`Current matches: ${count || 0}\n`);

if (!count || count < 20) {
  console.log('⚠️ Few or no matches found. The matching engine needs to run.');
  console.log('\nTo generate matches, run:');
  console.log('  node match-regenerator.js');
  console.log('\nOr generate matches just for this startup:');
  console.log('  node generate-single-startup-matches.js ' + startupId);
} else {
  console.log('✓ Matches exist. They should appear on the /matches page.');
}

process.exit(0);
