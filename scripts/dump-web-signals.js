const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data } = await sb.from('startup_uploads')
    .select('name, total_god_score, extracted_data')
    .ilike('name', '%Hebbia%')
    .limit(1);
  
  const s = data?.[0];
  if (!s) { console.log('not found'); return; }
  
  console.log('name:', s.name, ' GOD:', s.total_god_score);
  const ws = s.extracted_data?.web_signals;
  console.log('\nweb_signals keys:', Object.keys(ws || {}));
  console.log('\nFull web_signals:');
  console.log(JSON.stringify(ws, null, 2));
})();
