import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: firgun } = await supabase
    .from('startup_uploads')
    .select('id, name, status')
    .ilike('name', '%firgun%');
  
  console.log('Found Firgun entries:', firgun?.length || 0);
  firgun?.forEach(s => console.log('  -', s.name, '(' + s.status + ')'));

  const { data: weekly } = await supabase
    .from('startup_uploads')
    .select('id, name, status')
    .ilike('name', '%weekly%');
  
  console.log('\nFound Weekly entries:', weekly?.length || 0);
  weekly?.slice(0, 20).forEach(s => console.log('  -', s.name, '(' + s.status + ')'));
}

check().catch(console.error);
