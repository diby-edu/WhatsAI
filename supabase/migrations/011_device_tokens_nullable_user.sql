-- Allow device tokens to be stored without a user (for native app registration)
-- The token will be claimed when the user logs in

-- Remove NOT NULL constraint from user_id
ALTER TABLE device_tokens ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow service role to insert unclaimed tokens
-- (The existing "Service role full access" policy should already handle this)

-- Add a policy for claiming unclaimed tokens
CREATE POLICY "Users can claim unclaimed device tokens"
    ON device_tokens FOR UPDATE
    USING (user_id IS NULL)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN device_tokens.user_id IS 'User who owns this device. NULL for unclaimed tokens from native app.';
