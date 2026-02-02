import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function query() {
  console.log('Connecting to Supabase...');
  
  const { data, error, count } = await supabase
    .from('investors')
    .select('id, name, firm', { count: 'exact' })
    .or('firm.ilike.%sequoia%,firm.ilike.%andreessen%,firm.ilike.%founders fund%,firm.ilike.%greylock%,firm.ilike.%khosla%')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  console.log(`\nTotal investors in DB: ${count}`);
  console.log(`\nFound ${data?.length || 0} matching firms:\n`);
  
  data?.forEach(inv => {
    console.log(`${inv.firm.padEnd(25)} - ${inv.name.padEnd(30)} - ${inv.id}`);
  });
  
  process.exit(0);
}

query();
