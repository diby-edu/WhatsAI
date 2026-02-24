-- =============================================
-- Notification Preferences Schema
-- Version: 1.0.0
-- Fix: Robust trigger that doesn't block user signup
-- =============================================

-- 1. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Email notifications
    email_notifications BOOLEAN DEFAULT true,

    -- Push notifications
    push_notifications BOOLEAN DEFAULT true,

    -- SMS notifications
    sms_notifications BOOLEAN DEFAULT false,

    -- Notification types
    new_message BOOLEAN DEFAULT true,
    new_conversation BOOLEAN DEFAULT true,
    agent_offline BOOLEAN DEFAULT true,
    weekly_report BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one preference per user
    UNIQUE(user_id)
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
ON public.notification_preferences(user_id);

-- 3. Add updated_at trigger
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Create robust function with error handling
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert default preferences, ignore if already exists
    INSERT INTO public.notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN foreign_key_violation THEN
        -- Profile doesn't exist yet (race condition), ignore silently
        RETURN NEW;
    WHEN undefined_table THEN
        -- Table doesn't exist, ignore silently
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't block user signup
        RAISE WARNING 'create_default_notification_preferences error for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created_notification_prefs ON auth.users;

CREATE TRIGGER on_auth_user_created_notification_prefs
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_notification_preferences();

-- 6. Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 8. Create preferences for existing users who don't have them
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.notification_preferences)
ON CONFLICT (user_id) DO NOTHING;
