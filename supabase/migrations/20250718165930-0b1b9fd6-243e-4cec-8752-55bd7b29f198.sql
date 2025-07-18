-- Manually confirm any existing users by updating the email_confirmed_at field
UPDATE auth.users 
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;