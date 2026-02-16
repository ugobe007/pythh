-- ===========================================================================
-- AUTO-CREATE PROFILES FOR NEW AUTH USERS
-- ===========================================================================
-- This trigger automatically creates a profile when a user signs up
-- Admin emails are automatically granted admin access

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email IN (
        'admin@pythh.ai',
        'ugobe07@gmail.com',
        'aabramson@comunicano.com',
        'ugobe1@mac.com'
      ) THEN TRUE
      ELSE FALSE
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    is_admin = CASE 
      WHEN EXCLUDED.email IN (
        'admin@pythh.ai',
        'ugobe07@gmail.com',
        'aabramson@comunicano.com',
        'ugobe1@mac.com'
      ) THEN TRUE
      ELSE profiles.is_admin
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires when a user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

RAISE NOTICE '✅ Auth-profiles trigger created';
RAISE NOTICE '';
RAISE NOTICE '📋 Users can now sign up and profiles will be auto-created';
RAISE NOTICE '📋 Admin emails will automatically get is_admin = TRUE';
