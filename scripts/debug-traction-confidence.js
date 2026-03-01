const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await sb
    .from('startup_uploads')
    .select('name, traction_confidence, arr_usd, revenue_usd, parsed_customers, parsed_users, has_revenue, has_customers, startup_metrics')
    .eq('status', 'approved')
    .gte('traction_confidence', 0.35)
    .limit(5);

  if (error) { console.error(error); return; }

  data.forEach(r => {
    console.log('---');
    console.log('name:', r.name);
    console.log('traction_confidence:', r.traction_confidence);
    console.log('arr_usd:', r.arr_usd, '| revenue_usd:', r.revenue_usd);
    console.log('parsed_customers:', r.parsed_customers, '| parsed_users:', r.parsed_users);
    console.log('has_revenue (db col):', r.has_revenue, '| has_customers (db col):', r.has_customers);
    const m = r.startup_metrics;
    if (m && m.best_mentions) {
      const keys = Object.keys(m.best_mentions);
      console.log('metrics found:', keys.join(', '));
      keys.forEach(k => {
        const mention = m.best_mentions[k];
        console.log(`  ${k}: conf=${mention.confidence} | amount=${mention.amount_usd || mention.value} | context="${(mention.context || '').substring(0, 80)}"`);
      });
    }
  });
}

check();
