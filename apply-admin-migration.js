require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🔄 Checking admin role system...\n');
    
    // Check if column exists
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('is_admin')
      .limit(1);
    
    if (testError && testError.message.includes('column "is_admin" does not exist')) {
      console.log('⚠️  is_admin column does not exist yet.');
      console.log('\n📋 MANUAL MIGRATION REQUIRED:');
      console.log('Go to Supabase Dashboard → SQL Editor and run:\n');
      console.log('─────────────────────────────────────────────────────');
      console.log(`
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
  ON profiles(is_admin) 
  WHERE is_admin = TRUE;

UPDATE profiles 
SET is_admin = TRUE 
WHERE email IN (
  'aabramson@comunicano.com',
  'ugobe07@gmail.com',
  'ugobe1@mac.com',
  'admin@pythh.ai'
);
      `);
      console.log('─────────────────────────────────────────────────────\n');
      console.log('After running the SQL above, run this script again to verify.');
      process.exit(0);
    }
    
    console.log('✅ is_admin column exists\n');
    
    // Update admin users
    console.log('📝 Granting admin access to emails...');
    const adminEmails = [
      'aabramson@comunicano.com',
      'ugobe07@gmail.com',
      'ugobe1@mac.com',
      'admin@pythh.ai'
    ];
    
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .in('email', adminEmails)
      .select();
    
    if (updateError) {
      console.log('⚠️  Could not update via API (might be RLS)');
      console.log('Please run this in Supabase SQL Editor:\n');
      console.log(`
UPDATE profiles 
SET is_admin = TRUE 
WHERE email IN (
  'aabramson@comunicano.com',
  'ugobe07@gmail.com',
  'ugobe1@mac.com',
  'admin@pythh.ai'
);
      `);
    } else {
      console.log(`✅ Updated ${updated?.length || 0} users to admin\n`);
    }
    
    // Verify
    console.log('🔍 Current admin users:');
    const { data: admins, error: verifyError } = await supabase
      .from('profiles')
      .select('email, is_admin')
      .eq('is_admin', true);
    
    if (verifyError) {
      console.log('⚠️  Could not verify (might be RLS)');
    } else if (admins && admins.length > 0) {
      admins.forEach(admin => {
        console.log(`   - ${admin.email}`);
      });
      console.log('\n🎉 Admin system configured!');
    } else {
      console.log('   (none found - run UPDATE query in SQL Editor)');
    }
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Logout of pythh app');
    console.log('2. Login with: admin@pythh.ai');
    console.log('3. Navigate to: /admin/control');
    console.log('4. You should NOT be redirected to home ✅\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

applyMigration();
