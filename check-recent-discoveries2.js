import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRecent() {
  const { data, error } = await supabase
    .from('discovered_startups')
    .select('name, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No recent discoveries found');
    return;
  }
  
  console.log(`Last ${data.length} discoveries:`);
  data.forEach((d, i) => {
    console.log(`${i+1}. "${d.name}" - ${new Date(d.created_at).toLocaleString()}`);
  });
}

checkRecent().catch(console.error);
