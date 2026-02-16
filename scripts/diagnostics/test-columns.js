require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { data, error } = await sb.from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('status', 'approved')
    .limit(2);
  console.log('Basic:', data?.length, error?.message);
  
  const cols = ['description', 'pitch', 'problem', 'solution', 'tagline', 'value_proposition', 'website', 'mrr', 'arr', 'revenue', 'customer_count', 'growth_rate_monthly', 'team_size', 'has_technical_cofounder', 'is_launched', 'has_demo', 'founded_date', 'backed_by', 'team_companies', 'sectors', 'extracted_data'];
  for (const col of cols) {
    const { data: d, error: e } = await sb.from('startup_uploads')
      .select('id, ' + col)
      .eq('status', 'approved')
      .limit(1);
    if (e || !d || d.length === 0) {
      console.log('BAD COLUMN:', col, e?.message);
    }
  }
  console.log('Done testing columns');
}
test();
