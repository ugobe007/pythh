-- ===========================================================================
-- ADD PROPER ADMIN ROLE SYSTEM
-- ===========================================================================
-- Replace hardcoded ADMIN_EMAILS with database-backed admin role
-- This allows ANY email to be granted admin access without code changes

-- Add is_admin column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for fast admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
  ON profiles(is_admin) 
  WHERE is_admin = TRUE;

-- Add comment
COMMENT ON COLUMN profiles.is_admin IS 
'Admin flag for system access. Set to TRUE to grant full admin permissions.';

-- Grant admin access to known admin emails
UPDATE profiles 
SET is_admin = TRUE 
WHERE email IN (
  'aabramson@comunicano.com',
  'ugobe07@gmail.com',
  'ugobe1@mac.com',
  'admin@pythh.ai'
);

-- Validation
DO $$
DECLARE
  admin_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE is_admin = TRUE;
  
  RAISE NOTICE '✅ Admin role system created';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Current admin users: %', admin_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 To grant admin access to a user:';
  RAISE NOTICE '   UPDATE profiles SET is_admin = TRUE WHERE email = ''user@example.com'';';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 To revoke admin access:';
  RAISE NOTICE '   UPDATE profiles SET is_admin = FALSE WHERE email = ''user@example.com'';';
END $$;
