import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCleanup() {
  const { count: rejected } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rejected')
    .gte('updated_at', '2026-01-24T00:00:00');
  
  const { count: total } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true });
  
  const { count: uploads } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Rejected today: ${rejected}`);
  console.log(`Total discovered_startups: ${total}`);
  console.log(`Total startup_uploads: ${uploads}`);
  console.log(`Discovered/Uploads ratio: ${(total/uploads*100).toFixed(0)}%`);
}

checkCleanup();
