-- Migration: Separate admin notification preferences by delivery channel (Email vs Push)
-- This extends admin_notification_preferences to have separate email_ and push_ toggles

-- Add Email notification columns
ALTER TABLE admin_notification_preferences
ADD COLUMN IF NOT EXISTS email_new_user BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_plan_upgrade BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_plan_downgrade BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_payment_received BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_payment_failed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_subscription_cancelled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_agent_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_agent_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_agent_disconnected BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_agent_quota_exceeded BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_openai_error BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_whatsapp_down BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_high_error_rate BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_new_conversation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_new_order BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_escalation BOOLEAN DEFAULT true;

-- Add Push notification columns
ALTER TABLE admin_notification_preferences
ADD COLUMN IF NOT EXISTS push_new_user BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_plan_upgrade BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_plan_downgrade BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_payment_received BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_payment_failed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_subscription_cancelled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_agent_created BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_agent_connected BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_agent_disconnected BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_agent_quota_exceeded BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_openai_error BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_whatsapp_down BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_high_error_rate BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_new_conversation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS push_new_order BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_escalation BOOLEAN DEFAULT true;

-- Migrate existing notif_ values to both email_ and push_ (for backwards compatibility)
UPDATE admin_notification_preferences SET
    email_new_user = COALESCE(notif_new_user, true),
    email_plan_upgrade = COALESCE(notif_plan_upgrade, true),
    email_plan_downgrade = COALESCE(notif_plan_downgrade, true),
    email_payment_received = COALESCE(notif_payment_received, true),
    email_payment_failed = COALESCE(notif_payment_failed, true),
    email_subscription_cancelled = COALESCE(notif_subscription_cancelled, true),
    email_agent_created = COALESCE(notif_agent_created, false),
    email_agent_connected = COALESCE(notif_agent_connected, false),
    email_agent_disconnected = COALESCE(notif_agent_disconnected, true),
    email_agent_quota_exceeded = COALESCE(notif_agent_quota_exceeded, true),
    email_openai_error = COALESCE(notif_openai_error, true),
    email_whatsapp_down = COALESCE(notif_whatsapp_down, true),
    email_high_error_rate = COALESCE(notif_high_error_rate, true),
    email_new_conversation = COALESCE(notif_new_conversation, false),
    email_new_order = COALESCE(notif_new_order, true),
    email_escalation = COALESCE(notif_escalation, true),
    push_new_user = COALESCE(notif_new_user, true),
    push_plan_upgrade = COALESCE(notif_plan_upgrade, true),
    push_plan_downgrade = COALESCE(notif_plan_downgrade, true),
    push_payment_received = COALESCE(notif_payment_received, true),
    push_payment_failed = COALESCE(notif_payment_failed, true),
    push_subscription_cancelled = COALESCE(notif_subscription_cancelled, true),
    push_agent_created = COALESCE(notif_agent_created, true),
    push_agent_connected = COALESCE(notif_agent_connected, true),
    push_agent_disconnected = COALESCE(notif_agent_disconnected, true),
    push_agent_quota_exceeded = COALESCE(notif_agent_quota_exceeded, true),
    push_openai_error = COALESCE(notif_openai_error, true),
    push_whatsapp_down = COALESCE(notif_whatsapp_down, true),
    push_high_error_rate = COALESCE(notif_high_error_rate, true),
    push_new_conversation = COALESCE(notif_new_conversation, false),
    push_new_order = COALESCE(notif_new_order, true),
    push_escalation = COALESCE(notif_escalation, true)
WHERE id IS NOT NULL;

-- Documentation
COMMENT ON COLUMN admin_notification_preferences.email_new_user IS 'Send email when a new user registers';
COMMENT ON COLUMN admin_notification_preferences.email_payment_failed IS 'Send email when payment fails (critical)';
COMMENT ON COLUMN admin_notification_preferences.email_whatsapp_down IS 'Send email when WhatsApp service is down (critical)';
COMMENT ON COLUMN admin_notification_preferences.push_new_user IS 'Send push notification when a new user registers';
COMMENT ON COLUMN admin_notification_preferences.push_payment_failed IS 'Send push notification when payment fails (critical)';
COMMENT ON COLUMN admin_notification_preferences.push_whatsapp_down IS 'Send push notification when WhatsApp service is down (critical)';
