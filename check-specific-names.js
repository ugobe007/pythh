import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
);

const namesToCheck = ['Roger Wang', 'Kaichao You', 'Inferact', 'Woosuk Kwon', 'Simon', 'Jonah Cader'];

async function checkNames() {
  for (const name of namesToCheck) {
    const { data: inDiscovered } = await supabase
      .from('discovered_startups')
      .select('id, name, created_at')
      .eq('name', name)
      .limit(1);
    
    const { data: inUploads } = await supabase
      .from('startup_uploads')
      .select('id, name, created_at')
      .eq('name', name)
      .limit(1);
    
    console.log(`"${name}": discovered=${inDiscovered?.length || 0}, uploads=${inUploads?.length || 0}`);
  }
}

checkNames().catch(console.error);
