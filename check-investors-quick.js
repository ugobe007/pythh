// Quick script to check investors in database
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkInvestors() {
  console.log('Querying investors...');
  
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, firm')
    .or('firm.ilike.%sequoia%,firm.ilike.%andreessen%,firm.ilike.%founders fund%,firm.ilike.%greylock%,firm.ilike.%khosla%')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`\nFound ${data?.length || 0} investors:`);
  data?.forEach(inv => {
    console.log(`  ${inv.firm} - ${inv.name} (${inv.id})`);
  });
}

checkInvestors();
