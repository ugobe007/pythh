-- Grant admin to John Emmons (Project Wilbur)
-- Apply in Supabase SQL editor if remote migration history is out of sync.

UPDATE public.profiles
SET is_admin = TRUE
WHERE lower(email) = lower('emmons@projectwilbur.com');

-- New signups: auto-admin for this email (matches src/lib/adminConfig.ts)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN LOWER(NEW.email) IN (
        'admin@pythh.ai',
        'ugobe07@gmail.com',
        'aabramson@comunicano.com',
        'ugobe1@mac.com',
        'emmons@projectwilbur.com'
      ) THEN TRUE
      ELSE FALSE
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    is_admin = CASE
      WHEN LOWER(EXCLUDED.email) IN (
        'admin@pythh.ai',
        'ugobe07@gmail.com',
        'aabramson@comunicano.com',
        'ugobe1@mac.com',
        'emmons@projectwilbur.com'
      ) THEN TRUE
      ELSE profiles.is_admin
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
  'Creates profile on auth signup; is_admin for allowlisted emails including emmons@projectwilbur.com';
