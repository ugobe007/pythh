const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🧪 Testing startup creation (simulating PythhMatchingEngine)\n');
  
  const testUrl = 'https://test-startup-' + Date.now() + '.com';
  const domain = 'test-startup-' + Date.now();
  const companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
  
  const testData = {
    name: companyName,
    website: testUrl,
    tagline: `Startup at ${domain}`,
    sectors: ['Technology'],
    stage: 1,
    status: 'approved',
    source_type: 'url',
    total_god_score: 65,
    created_at: new Date().toISOString()
  };
  
  console.log('Data to insert:', JSON.stringify(testData, null, 2));
  console.log('\nAttempting insert...');
  
  const { data, error } = await supabase
    .from('startup_uploads')
    .insert(testData)
    .select('id')
    .single();
  
  if (error) {
    console.log('\n❌ INSERT FAILED');
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    console.log('Error details:', error.details);
    console.log('Error hint:', error.hint);
    console.log('\nThis is why you see "Could not resolve startup from URL"');
    process.exit(1);
  } else {
    console.log('\n✅ INSERT SUCCESS!');
    console.log('Created startup ID:', data.id);
    
    // Clean up
    await supabase.from('startup_uploads').delete().eq('id', data.id);
    console.log('\n✅ Database insert works fine!');
    console.log('\nThe issue must be elsewhere. Check:');
    console.log('1. Browser console for actual error');
    console.log('2. Network tab to see if request is being made');
    console.log('3. Make sure you hard-refreshed browser (Cmd+Shift+R)');
    process.exit(0);
  }
})();
