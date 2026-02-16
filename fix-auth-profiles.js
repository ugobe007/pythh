require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAuthProfiles() {
  try {
    console.log('🔧 Fixing auth-profiles connection...\n');
    
    // Step 1: Check if auth user exists for admin@pythh.ai
    const { data: { user }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('⚠️  Cannot list auth users:', authError.message);
      console.log('\n📋 MANUAL FIX REQUIRED:');
      console.log('Run this SQL in Supabase Dashboard:\n');
      console.log(`
-- Create trigger to auto-create profiles for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email IN ('admin@pythh.ai', 'ugobe07@gmail.com', 'aabramson@comunicano.com', 'ugobe1@mac.com') THEN TRUE
      ELSE FALSE
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    is_admin = CASE 
      WHEN EXCLUDED.email IN ('admin@pythh.ai', 'ugobe07@gmail.com', 'aabramson@comunicano.com', 'ugobe1@mac.com') THEN TRUE
      ELSE profiles.is_admin
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
      `);
      return;
    }
    
    const users = user || [];
    console.log(`📊 Found ${users.length} auth users\n`);
    
    // Find admin@pythh.ai
    const adminUser = users.find(u => u.email === 'admin@pythh.ai');
    
    if (!adminUser) {
      console.log('⚠️  admin@pythh.ai does not have an auth account yet');
      console.log('\n📋 Please sign up with admin@pythh.ai first');
      console.log('1. Go to: http://localhost:5173/login');
      console.log('2. Click "Sign Up"');
      console.log('3. Use email: admin@pythh.ai');
      console.log('4. Set a password');
      console.log('5. After signup, run this script again');
      return;
    }
    
    console.log('✅ Auth user found:');
    console.log('   Email:', adminUser.email);
    console.log('   ID:', adminUser.id);
    console.log();
    
    // Step 2: Update or create profile with correct ID
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();
    
    if (existingProfile) {
      console.log('✅ Profile already linked to auth user');
      console.log('   Updating is_admin flag...');
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: true, email: adminUser.email })
        .eq('id', adminUser.id);
      
      if (updateError) {
        console.log('❌ Update failed:', updateError.message);
      } else {
        console.log('✅ Profile updated successfully!');
      }
    } else {
      console.log('📝 Creating profile linked to auth user...');
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.user_metadata?.name || 'Admin',
          is_admin: true
        })
        .select()
        .single();
      
      if (insertError) {
        console.log('❌ Insert failed:', insertError.message);
        console.log('\nTry running this SQL manually:');
        console.log(`
INSERT INTO profiles (id, email, name, is_admin)
VALUES ('${adminUser.id}', '${adminUser.email}', 'Admin', TRUE)
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
        `);
      } else {
        console.log('✅ Profile created successfully!');
        console.log('   ID:', newProfile.id);
        console.log('   Email:', newProfile.email);
        console.log('   Is Admin:', newProfile.is_admin);
      }
    }
    
    console.log('\n🎉 Auth-profiles connection fixed!');
    console.log('\n📋 Now you can log in:');
    console.log('1. Go to: http://localhost:5173/login');
    console.log('2. Email: admin@pythh.ai');
    console.log('3. Your password');
    console.log('4. Should redirect to /admin ✅');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAuthProfiles();
