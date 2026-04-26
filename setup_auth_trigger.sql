-- ==========================================
-- AUTOMATIC USER PROFILE CREATION TRIGGER
-- ==========================================

-- 1. Create the function that will handle the insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    new.id, 
    -- Try to get name from metadata, fallback to email prefix
    COALESCE(
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'name', 
        SPLIT_PART(new.email, '@', 1)
    ),
    new.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- 2. Create the trigger on auth.users
-- This runs EVERY time a new user is created in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Sync existing users
-- This ensures anyone already signed up has a profile row
INSERT INTO public.users (id, name, email)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1)),
    email
FROM auth.users
ON CONFLICT (id) DO NOTHING;
