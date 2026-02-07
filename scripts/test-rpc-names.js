const path = require('path');
process.chdir('/Users/leguplabs/Desktop/hot-honey');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('id, name')
    .eq('status', 'approved')
    .limit(1)
    .single();
  
  if (!startup) return console.log('No startup found');
  console.log('Testing with startup:', startup.name, startup.id);
  
  const { data, error } = await supabase.rpc('get_live_match_table', {
    p_startup_id: startup.id,
    p_limit_unlocked: 5,
    p_limit_locked: 20
  });
  
  if (error) return console.log('RPC Error:', error);
  
  console.log('First 5 rows:');
  (data || []).slice(0, 5).forEach((row, i) => {
    console.log((i+1) + '.', JSON.stringify({
      investor_name: row.investor_name,
      is_locked: row.is_locked,
      rank: row.rank
    }));
  });
})();
