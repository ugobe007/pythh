import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkNames() {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id, name, status, total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n=== Top 10 Startups ===');
  data.forEach((s, i) => {
    console.log(`${i + 1}. "${s.name}" (GOD: ${s.total_god_score})`);
  });
}

checkNames();
