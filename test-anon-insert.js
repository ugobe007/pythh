const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Test with ANON key (what the browser uses)
const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔐 Testing startup creation with ANON KEY (browser simulation)...\n');
  
  const testStartup = {
    name: 'Frontend Test ' + Date.now(),
    website: 'https://frontend-test-' + Date.now() + '.com',
    tagline: 'Test from frontend',
    sectors: ['Technology'],
    stage: 1,
    status: 'approved',
    source_type: 'url',
    total_god_score: 65,
    created_at: new Date().toISOString()
  };
  
  console.log('📝 Attempting INSERT with ANON KEY...');
  console.log('📝 Name:', testStartup.name);
  
  const { data, error } = await supabaseAnon
    .from('startup_uploads')
    .insert(testStartup)
    .select('id')
    .single();
    
  if (error) {
    console.log('\n❌ INSERT FAILED (This is the browser error!)\n');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    
    if (error.code === '42501') {
      console.log('\n🔴 RLS POLICY BLOCKING ANON KEY');
      console.log('\nThe anon key cannot insert into startup_uploads.');
      console.log('You need to add an RLS policy in Supabase:\n');
      console.log('1. Go to: Supabase Dashboard > Authentication > Policies');
      console.log('2. Table: startup_uploads');
      console.log('3. Add INSERT policy: Allow anonymous INSERT\n');
      console.log('SQL to run in Supabase SQL Editor:\n');
      console.log(`
CREATE POLICY "Allow anonymous insert for URL submissions"
ON startup_uploads
FOR INSERT
TO anon
WITH CHECK (source_type = 'url');
      `);
    }
  } else {
    console.log('\n✅ INSERT SUCCESS with ANON KEY!');
    console.log('New startup ID:', data.id);
    console.log('\n🎉 Frontend should work correctly!');
  }
})();
