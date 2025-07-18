-- Manually confirm any existing users that were created before auto-confirmation was enabled
UPDATE auth.users 
SET email_confirmed_at = now(), 
    confirmed_at = now() 
WHERE email_confirmed_at IS NULL;