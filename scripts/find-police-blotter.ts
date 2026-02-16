import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function findPoliceBlotter() {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id, name, status')
    .or('name.ilike.%police%,name.ilike.%blotter%')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('✅ No "police" or "blotter" entries found');
    return;
  }

  console.log(`\n🔍 Found ${data.length} entries:\n`);
  data.forEach(s => {
    console.log(`  • ${s.name} (id: ${s.id}, status: ${s.status})`);
  });

  // Delete them
  console.log('\n🗑️  Deleting non-startup entries...');
  for (const entry of data) {
    const { error: delError } = await supabase
      .from('startup_uploads')
      .delete()
      .eq('id', entry.id);
    
    if (delError) {
      console.error(`❌ Failed to delete ${entry.name}:`, delError);
    } else {
      console.log(`✅ Deleted: ${entry.name}`);
    }
  }
}

findPoliceBlotter();
