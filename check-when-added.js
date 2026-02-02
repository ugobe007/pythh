import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
);

const namesToCheck = ['Roger Wang', 'Inferact', 'Woosuk Kwon'];

async function checkWhen() {
  for (const name of namesToCheck) {
    const { data } = await supabase
      .from('discovered_startups')
      .select('name, created_at')
      .eq('name', name)
      .single();
    
    if (data) {
      console.log(`"${name}": added ${new Date(data.created_at).toLocaleString()}`);
    }
  }
}

checkWhen().catch(console.error);
