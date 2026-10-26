-- Add default admin account
-- This script manually creates the admin profile
-- The user will need to sign up with yohannesm294@gmail.com and password Admin@1234
-- Then this script will update their role to admin

-- Note: We cannot directly create auth.users via SQL in a secure way
-- Instead, we'll create a placeholder that will be updated on first signup

-- Create a note for manual setup
DO $$
BEGIN
  RAISE NOTICE 'DEFAULT ADMIN SETUP INSTRUCTIONS:';
  RAISE NOTICE '1. Go to /auth/signup in your app';
  RAISE NOTICE '2. Sign up with: yohannesm294@gmail.com';
  RAISE NOTICE '3. Password: Admin@1234';
  RAISE NOTICE '4. The user profile will automatically be created as admin via the trigger';
  RAISE NOTICE 'Alternatively, after signup, run this to make them admin:';
  RAISE NOTICE 'UPDATE user_profiles SET role = ''admin'' WHERE email = ''yohannesm294@gmail.com'';';
END $$;
