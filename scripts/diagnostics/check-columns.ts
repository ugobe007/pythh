import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const { data } = await supabase.from('startup_uploads').select('*').eq('status','approved').limit(1);
  if (data && data[0]) {
    console.log('COLUMNS:', Object.keys(data[0]).join(', '));
    const ed = data[0].extracted_data || {};
    console.log('ED KEYS:', Object.keys(ed).join(', '));
  }

  // Also check a data-rich bachelor
  const { data: rich } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status','approved')
    .gte('total_god_score', 50)
    .lte('total_god_score', 59)
    .order('total_god_score', { ascending: false })
    .limit(3);
  
  if (rich) {
    for (const r of rich) {
      console.log(`\n--- ${r.name} | GOD: ${r.total_god_score} ---`);
      console.log('ED KEYS:', Object.keys(r.extracted_data || {}).join(', '));
      const ed = r.extracted_data || {};
      // Show all non-empty values
      for (const [k, v] of Object.entries(ed)) {
        if (v && String(v).length > 0 && String(v) !== '[]' && String(v) !== '{}') {
          const val = typeof v === 'string' ? v.substring(0, 80) : JSON.stringify(v).substring(0, 80);
          console.log(`  ${k}: ${val}`);
        }
      }
    }
  }
}
main();
