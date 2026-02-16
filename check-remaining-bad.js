const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const checks = [
    ['San Francisco', 'ilike'], ['New York', 'ilike'], ['Mountain View', 'ilike'],
    ['Summer 20', 'ilike'], ['Winter 20', 'ilike'], ['Spring 20', 'ilike'], ['Fall 20', 'ilike'],
    [', CA, USA', 'ilike'], [', NY, USA', 'ilike']
  ];
  console.log('=== REMAINING BAD NAMES ===');
  let totalBad = 0;
  for (const [pattern] of checks) {
    const { count } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true })
      .eq('status', 'approved').ilike('name', '%' + pattern + '%');
    if (count > 0) {
      console.log('  "' + pattern + '": ' + count);
      totalBad += count;
    }
  }
  console.log('Total bad remaining (with overlap):', totalBad);
  console.log('\nDone');
})();
