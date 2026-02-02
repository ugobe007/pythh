import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function test() {
  // Test update on one record
  const { data: before } = await s.from('startup_uploads')
    .select('id, name, team_score, vision_score')
    .eq('name', 'Our')
    .single();
  console.log('BEFORE:', before);

  // Try to update with correct values
  const { data: updated, error } = await s.from('startup_uploads')
    .update({ team_score: 43, vision_score: 28 })
    .eq('name', 'Our')
    .select('id, name, team_score, vision_score')
    .single();

  if (error) console.log('ERROR:', error);
  else console.log('AFTER UPDATE:', updated);

  // Read it back
  const { data: after } = await s.from('startup_uploads')
    .select('id, name, team_score, vision_score')
    .eq('name', 'Our')
    .single();
  console.log('READ BACK:', after);
}
test();
