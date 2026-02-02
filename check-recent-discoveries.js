import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRecent() {
  const { data } = await supabase
    .from('discovered_startups')
    .select('name, created_at, source_url')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log('Last 20 discoveries:');
  data.forEach((d, i) => {
    console.log(`${i+1}. "${d.name}" - ${new Date(d.created_at).toLocaleString()}`);
  });
  
  // Check how many in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24*60*60*1000).toISOString();
  const { count } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo);
  
  console.log(`\nTotal in last 24 hours: ${count}`);
}

checkRecent().catch(console.error);
