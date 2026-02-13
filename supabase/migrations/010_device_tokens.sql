-- Device tokens for push notifications
-- Run this migration in Supabase SQL Editor

-- Create device_tokens table
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- Enable RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own device tokens
CREATE POLICY "Users can view own device tokens"
    ON device_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device tokens"
    ON device_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device tokens"
    ON device_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own device tokens"
    ON device_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can access all tokens (for sending notifications)
CREATE POLICY "Service role full access"
    ON device_tokens FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Function to clean up old/unused tokens (older than 30 days without update)
CREATE OR REPLACE FUNCTION cleanup_old_device_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM device_tokens
    WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE device_tokens IS 'Stores FCM/APNs tokens for push notifications';
COMMENT ON COLUMN device_tokens.token IS 'FCM or APNs device token';
COMMENT ON COLUMN device_tokens.platform IS 'Device platform: android, ios, or web';
