-- Notification preferences for users
-- Run this migration in Supabase SQL Editor

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Email notifications
    email_new_conversation BOOLEAN DEFAULT true,
    email_daily_summary BOOLEAN DEFAULT true,
    email_low_credits BOOLEAN DEFAULT true,
    email_new_order BOOLEAN DEFAULT true,
    email_agent_status_change BOOLEAN DEFAULT true,

    -- Push notifications (mobile app)
    push_enabled BOOLEAN DEFAULT true,
    push_new_conversation BOOLEAN DEFAULT true,
    push_new_order BOOLEAN DEFAULT true,
    push_low_credits BOOLEAN DEFAULT true,
    push_agent_status_change BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own preferences
CREATE POLICY "Users can view own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can access all preferences (for sending notifications)
CREATE POLICY "Service role full access notification preferences"
    ON notification_preferences FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Function to create default preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create preferences for new users
DROP TRIGGER IF EXISTS on_auth_user_created_notification_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_prefs
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Create default preferences for existing users who don't have them
INSERT INTO notification_preferences (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE notification_preferences IS 'User preferences for email and push notifications';
