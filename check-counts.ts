import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function getCounts() {
  const [investors, startups, matches] = await Promise.all([
    supabase.from('investors').select('*', { count: 'exact', head: true }),
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
    supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true })
  ]);
  
  console.log('📊 Database Counts:');
  console.log('  Investors:', investors.count || 0);
  console.log('  Startups:', startups.count || 0);
  console.log('  Matches:', matches.count || 0);
}

getCounts().catch(console.error);
